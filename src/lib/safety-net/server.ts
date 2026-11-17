import { formatClinicDate } from "@/lib/care-loop/format";
import { firstName } from "@/lib/care-loop/messages";
import type { Actor, Db } from "@/lib/care-loop/server";
import type { Tables } from "@/types/database";
import type { MessageContext } from "./messages";
import { getProtocol } from "./protocols";
import { getTransport } from "./transport";
import {
  applyReply,
  applyTimers,
  type FollowupSnapshot,
  type InboundReply,
  type LifecycleEvent,
  type Outcome,
} from "./workflow";

// Shared write path for safety-net follow-ups, used by staff actions (their own
// RLS-scoped client), the simulated phone and the scheduler (service role).

export type FollowupRecord = Tables<"safety_net_followups">;

export async function loadFollowup(db: Db, id: string, clinicId?: string) {
  let query = db.from("safety_net_followups").select("*").eq("id", id);
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Follow-up not found.");
  return data as FollowupRecord;
}

export async function loadFollowupByToken(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const { data, error } = await db.from("safety_net_followups").select("*").eq("sim_token", token).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FollowupRecord | null) ?? null;
}

export function snapshotOf(followup: FollowupRecord): FollowupSnapshot {
  return {
    state: followup.state,
    question_ids: followup.question_ids ?? [],
    answers: followup.answers ?? {},
    language: followup.language,
    current_step_due_at: followup.current_step_due_at,
    closed_at: followup.closed_at,
  };
}

export async function messageContext(db: Db, followup: FollowupRecord): Promise<MessageContext & { phone: string | null }> {
  const [clinicRes, patientRes, encounterRes] = await Promise.all([
    db.from("clinics").select("name").eq("id", followup.clinic_id).single(),
    db.from("patients").select("full_name, phone").eq("id", followup.patient_id).single(),
    db.from("encounters").select("encounter_date, created_at").eq("id", followup.encounter_id).single(),
  ]);
  for (const res of [clinicRes, patientRes, encounterRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  const visit = encounterRes.data!.encounter_date ?? encounterRes.data!.created_at;
  return {
    clinicName: clinicRes.data!.name,
    patientFirstName: firstName(patientRes.data!.full_name),
    visitDate: formatClinicDate(visit),
    phone: patientRes.data!.phone ?? null,
  };
}

export async function recordFollowupEvent(
  db: Db,
  followup: Pick<FollowupRecord, "id" | "clinic_id">,
  actor: Actor | null,
  event: LifecycleEvent
) {
  const { error } = await db.from("safety_net_events").insert({
    clinic_id: followup.clinic_id,
    followup_id: followup.id,
    event_type: event.type,
    actor_staff_id: actor?.kind === "staff" ? actor.staffId : null,
    actor_label: actor?.kind === "external" ? actor.label : null,
    note: event.note?.trim() || null,
    data: event.data ?? {},
  });
  if (error) throw new Error(error.message);
}

/**
 * Writes an outcome: the follow-up fields, then the outbound messages, then the
 * events. The update only applies if nothing changed the follow-up since it was
 * read, so a tap and the scheduler can't both act on the same step.
 */
export async function persistOutcome(
  db: Db,
  followup: FollowupRecord,
  outcome: Outcome,
  actor: Actor | null,
  phone: string | null = null
): Promise<FollowupRecord | null> {
  let updated = followup;
  if (Object.keys(outcome.patch).length > 0) {
    const { data, error } = await db
      .from("safety_net_followups")
      .update({ ...outcome.patch, updated_at: new Date().toISOString() })
      .eq("id", followup.id)
      .eq("updated_at", followup.updated_at)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    updated = data as FollowupRecord;
  }

  const transport = getTransport();
  for (const message of outcome.outbound) {
    await transport.send({ phone }, message);
    const { error } = await db.from("safety_net_messages").insert({
      clinic_id: followup.clinic_id,
      followup_id: followup.id,
      direction: "out",
      kind: message.kind,
      body: message.body,
      question_id: message.kind === "text" ? null : message.questionId,
      options: message.kind === "text" ? null : message.options,
    });
    if (error) throw new Error(error.message);
  }

  for (const event of outcome.events) {
    await recordFollowupEvent(db, followup, actor, event);
  }
  return updated;
}

const PATIENT: Actor = { kind: "external", label: "Patient (WhatsApp)" };
const SCHEDULER: Actor = { kind: "external", label: "Scheduler" };

/** A reply from the patient's WhatsApp. Always logged, then applied if it fits the conversation. */
export async function handleInbound(db: Db, followup: FollowupRecord, reply: InboundReply) {
  const protocol = getProtocol(followup.protocol_code);
  if (!protocol) throw new Error("Unknown question set.");

  let body = reply.kind === "text" ? reply.text.trim() : reply.value;
  if (reply.kind === "button") {
    const { data } = await db
      .from("safety_net_messages")
      .select("options")
      .eq("followup_id", followup.id)
      .eq("question_id", reply.questionId)
      .eq("direction", "out")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const options = (data?.options ?? []) as Array<{ value: string; label: string }>;
    body = options.find((option) => option.value === reply.value)?.label ?? reply.value;
  }
  if (!body) return { status: "ignored" as const };

  const { error } = await db.from("safety_net_messages").insert({
    clinic_id: followup.clinic_id,
    followup_id: followup.id,
    direction: "in",
    kind: reply.kind === "text" ? "text" : "button_reply",
    body,
    question_id: reply.kind === "button" ? reply.questionId : null,
    reply_value: reply.kind === "button" ? reply.value : null,
  });
  if (error) throw new Error(error.message);

  const ctx = await messageContext(db, followup);
  const result = applyReply(snapshotOf(followup), protocol, reply, ctx);
  if ("ignored" in result) return { status: "ignored" as const, reason: result.ignored };
  const saved = await persistOutcome(db, followup, result, PATIENT, ctx.phone);
  return saved ? { status: "applied" as const, followup: saved } : { status: "conflict" as const };
}

/** Applies due timers to one follow-up. Returns true when something happened. */
export async function runTimers(db: Db, followup: FollowupRecord, now: Date = new Date()) {
  const protocol = getProtocol(followup.protocol_code);
  if (!protocol) return false;
  const ctx = await messageContext(db, followup);
  const outcome = applyTimers(snapshotOf(followup), protocol, ctx, now);
  if (!outcome) return false;
  return (await persistOutcome(db, followup, outcome, SCHEDULER, ctx.phone)) !== null;
}

/** Sends due check-ins and turns overdue silence into nurse calls. */
export async function processDueFollowups(db: Db, options: { clinicId?: string; now?: Date } = {}) {
  const now = options.now ?? new Date();
  let query = db
    .from("safety_net_followups")
    .select("*")
    .in("state", ["scheduled", "awaiting_reply", "answering"])
    .lte("current_step_due_at", now.toISOString())
    .order("current_step_due_at", { ascending: true })
    .limit(200);
  if (options.clinicId) query = query.eq("clinic_id", options.clinicId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let processed = 0;
  for (const followup of (data ?? []) as FollowupRecord[]) {
    if (await runTimers(db, followup, now)) processed += 1;
  }
  return { processed };
}
