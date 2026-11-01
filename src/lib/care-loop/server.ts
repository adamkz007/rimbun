import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CaseStateValue, Tables } from "@/types/database";
import type { Urgency } from "./catalogue";
import { computeDueAt, stateIndex, type CaseState } from "./workflow";

// Shared write path for case changes, used both by staff actions (their own
// RLS-scoped client) and by the public patient and specialist links (service
// role, after the link token has been checked).

export type Db = Awaited<ReturnType<typeof getSupabaseServerClient>>;

export function getServiceDb() {
  return getSupabaseAdminClient() as unknown as Db;
}

export type CaseRecord = Tables<"result_cases">;

export type Actor =
  | { kind: "staff"; staffId: string }
  | { kind: "external"; label: string };

export async function loadCase(db: Db, caseId: string, clinicId?: string) {
  let query = db.from("result_cases").select("*").eq("id", caseId);
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Case not found.");
  return data as CaseRecord;
}

export async function recordCaseEvent(
  db: Db,
  item: Pick<CaseRecord, "id" | "clinic_id">,
  actor: Actor,
  event: {
    type: string;
    fromState?: CaseStateValue | null;
    toState?: CaseStateValue | null;
    note?: string | null;
    data?: Record<string, unknown>;
  }
) {
  const { error } = await db.from("case_events").insert({
    clinic_id: item.clinic_id,
    case_id: item.id,
    event_type: event.type,
    from_state: event.fromState ?? null,
    to_state: event.toState ?? null,
    actor_staff_id: actor.kind === "staff" ? actor.staffId : null,
    actor_label: actor.kind === "external" ? actor.label : null,
    note: event.note?.trim() || null,
    data: event.data ?? {},
  });
  if (error) throw new Error(error.message);
}

/** Milestone timestamps set the first time a case reaches each state. */
function milestoneFields(item: CaseRecord, next: CaseState, at: string) {
  const fields: Partial<CaseRecord> = {};
  const reached = (state: CaseState) => stateIndex(next) >= stateIndex(state);
  if (reached("notified") && !item.notified_at) fields.notified_at = at;
  if (reached("acknowledged") && !item.acknowledged_at) fields.acknowledged_at = at;
  if (reached("attended") && !item.care_started_at) fields.care_started_at = at;
  return fields;
}

/**
 * Moves a case to `next`, resets the due date for the new step and appends the
 * event. Extra fields are written in the same update.
 */
export async function transitionCase(
  db: Db,
  item: CaseRecord,
  next: CaseState,
  actor: Actor,
  event: { type: string; note?: string | null; data?: Record<string, unknown> },
  extra: Partial<CaseRecord> = {}
) {
  const at = new Date().toISOString();
  const update: Partial<CaseRecord> = {
    ...milestoneFields(item, next, at),
    ...extra,
    state: next,
    state_entered_at: at,
    current_step_due_at: computeDueAt(next, item.urgency as Urgency, at)?.toISOString() ?? null,
    updated_at: at,
  };

  const { data, error } = await db
    .from("result_cases")
    .update(update)
    .eq("id", item.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await recordCaseEvent(db, item, actor, {
    type: event.type,
    fromState: item.state,
    toState: next,
    note: event.note,
    data: event.data,
  });

  return data as CaseRecord;
}

/** Updates case fields without a state change, and records why. */
export async function updateCase(
  db: Db,
  item: CaseRecord,
  actor: Actor,
  fields: Partial<CaseRecord>,
  event: { type: string; note?: string | null; data?: Record<string, unknown> }
) {
  const { data, error } = await db
    .from("result_cases")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", item.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await recordCaseEvent(db, item, actor, { type: event.type, note: event.note, data: event.data });
  return data as CaseRecord;
}

/** The site's origin for building links, from the incoming request. */
export async function getRequestOrigin() {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
