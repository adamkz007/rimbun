import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FollowupDue, FollowupStateBadge, PrototypeNotice, RiskBadge, stateDetail } from "@/components/safety-net/badges";
import { RunDueButton } from "@/components/safety-net/followup-controls";
import { requirePageAccess } from "@/lib/auth";
import { formatClinicDate, formatClinicDateTime } from "@/lib/care-loop/format";
import { getProtocol } from "@/lib/safety-net/protocols";
import {
  CLOSURE_REASON_LABELS,
  compareForAction,
  isOverdue,
  summarizeAnswers,
  worklistOf,
  WORKLIST_LABELS,
  WORKLISTS,
  type FollowupWorklist,
} from "@/lib/safety-net/workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Relation<T> = T | T[] | null;
type Row = Tables<"safety_net_followups"> & {
  patients: Relation<{ full_name: string; mrn: string }>;
  owner: Relation<{ full_name: string }>;
};

function first<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** A row whose risk changed in the last few minutes gets a short highlight. */
const MOVED_WINDOW_MS = 10 * 60 * 1000;

function rowSummary(row: Row) {
  const protocol = getProtocol(row.protocol_code);
  const answers = protocol ? summarizeAnswers(protocol, row.answers ?? {}) : null;
  if (answers) return answers;
  if (row.state === "scheduled") return `Check-in ${formatClinicDateTime(row.checkin_due_at)}`;
  if (row.state === "awaiting_reply" && row.sent_at) {
    return `Check-in sent ${formatClinicDateTime(row.sent_at)}`;
  }
  if (row.call_attempts > 0) return `${row.call_attempts} unanswered call${row.call_attempts === 1 ? "" : "s"}`;
  return "No answers yet";
}

export default async function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requirePageAccess({ roles: ["doctor", "nurse"], module: "loop" });
  const supabase = await getSupabaseServerClient();
  const params = await searchParams;
  const requested = Array.isArray(params.list) ? params.list[0] : params.list;
  const list: FollowupWorklist = WORKLISTS.includes(requested as FollowupWorklist)
    ? (requested as FollowupWorklist)
    : "action";
  const now = new Date();
  const closedSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("safety_net_followups")
    .select("*, patients(full_name, mrn), owner:owner_staff_id(full_name)")
    .eq("clinic_id", staff.clinic_id)
    .or(`state.neq.closed,closed_at.gte.${closedSince}`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  const counts = Object.fromEntries(
    WORKLISTS.map((key) => [key, rows.filter((row) => worklistOf(row.state) === key).length])
  ) as Record<FollowupWorklist, number>;
  const escalated = rows.filter((row) => row.state === "escalated").length;
  const visible = rows
    .filter((row) => worklistOf(row.state) === list)
    .sort((left, right) =>
      list === "closed" ? (right.closed_at ?? "").localeCompare(left.closed_at ?? "") : compareForAction(left, right)
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Safety-net follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            WhatsApp check-ins after visits where the cause wasn&apos;t confirmed on the spot.
          </p>
        </div>
        <RunDueButton />
      </div>

      <PrototypeNotice />

      {escalated > 0 ? (
        <Link
          href="/followups?list=action"
          className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <span className="size-2 rounded-full bg-red-500" aria-hidden="true" />
          {escalated} high-risk follow-up{escalated === 1 ? "" : "s"}: a doctor needs to act now.
        </Link>
      ) : null}

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]" aria-label="Worklists">
        {WORKLISTS.map((key) => (
          <Link
            key={key}
            href={`/followups?list=${key}`}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              key === list ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {WORKLIST_LABELS[key]}
            <Badge variant={key === "action" && counts[key] > 0 ? "destructive" : "secondary"}>{counts[key]}</Badge>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {list === "action" ? "Nothing needs action right now." : "Nothing in this list."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {list !== "closed" ? (
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Sorted by risk, then due time</span>
              <span>Updated from patient replies</span>
            </div>
          ) : null}
          {visible.map((row) => {
            const patient = first(row.patients);
            const owner = first(row.owner);
            const protocol = getProtocol(row.protocol_code);
            const moved =
              row.state !== "closed" &&
              !!row.route_changed_at &&
              now.getTime() - new Date(row.route_changed_at).getTime() < MOVED_WINDOW_MS;
            const detail = stateDetail(row.state, row.call_reason);
            return (
              <Link key={row.id} href={`/followups/${row.id}`}>
                <Card
                  className={cn(
                    "transition-colors hover:border-primary/50",
                    moved && "ring-2 ring-amber-400 ring-offset-1 ring-offset-background",
                    isOverdue(row, now) && "border-l-4 border-l-destructive"
                  )}
                >
                  <CardContent className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] lg:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{patient?.full_name ?? "Unknown patient"}</p>
                        <RiskBadge route={row.route} state={row.state} />
                        {moved ? <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Moved just now</span> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{rowSummary(row)}</p>
                    </div>
                    <div className="space-y-1">
                      <FollowupStateBadge state={row.state} />
                      <p className="truncate text-xs text-muted-foreground">
                        {row.state === "closed" && row.closed_at
                          ? `${row.closure_reason ? CLOSURE_REASON_LABELS[row.closure_reason] : "Closed"} · ${formatClinicDate(row.closed_at)}`
                          : detail ?? protocol?.label ?? row.protocol_code}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Owner {owner?.full_name ?? "–"}</p>
                    <FollowupDue state={row.state} dueAt={row.current_step_due_at} now={now} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
