import Link from "next/link";
import { formatClinicDate } from "@/lib/care-loop/format";
import { BarChart3, Plus } from "lucide-react";
import { DueLabel, StateBadge, UrgencyBadge } from "@/components/care-loop/case-badges";
import { TriageList, type TriageResult } from "@/components/care-loop/triage-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageAccess } from "@/lib/auth";
import { compareUrgency, formatResultValue, getTest, type Urgency } from "@/lib/care-loop/catalogue";
import { computeLoopMetrics, formatDuration } from "@/lib/care-loop/metrics";
import {
  canTriageResults,
  isOverdue,
  matchesWorklist,
  NEXT_ACTION_LABELS,
  needsDoctorDecision,
  WORKLIST_LABELS,
  WORKLISTS,
  type CaseState,
  type ClosureReason,
  type Worklist,
} from "@/lib/care-loop/workflow";
import { getProtocol } from "@/lib/safety-net/protocols";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type CasesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Relation<T> = T | T[] | null;

type CaseRow = {
  id: string;
  state: CaseState;
  urgency: Urgency;
  test_code: string;
  owner_staff_id: string;
  current_step_due_at: string | null;
  opened_at: string;
  notified_at: string | null;
  acknowledged_at: string | null;
  understanding_correct: boolean | null;
  care_started_at: string | null;
  closed_at: string | null;
  closure_reason: ClosureReason | null;
  referral_rejected_at: string | null;
  contact_attempts: number;
  patients: Relation<{ id: string; full_name: string; mrn: string }>;
  owner: Relation<{ full_name: string }>;
  result: Relation<{ value_numeric: number | null; value_text: string | null; reported_at: string }>;
};

type FollowupCandidateRow = {
  id: string;
  patient_id: string;
  protocol_code: string;
  closure_reason: string | null;
  ordered_test_code: string | null;
  closed_at: string | null;
};

function first<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const staff = await requirePageAccess({ module: "loop" });
  const supabase = await getSupabaseServerClient();
  const params = await searchParams;
  const requested = Array.isArray(params.list) ? params.list[0] : params.list;
  const defaultList: Worklist = staff.role === "doctor" || staff.role === "nurse" ? "mine" : "open";
  const list: Worklist = WORKLISTS.includes(requested as Worklist) ? (requested as Worklist) : defaultList;
  const now = new Date();
  const closedSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const followupSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [casesRes, triageRes, staffRes, referralsRes, followupsRes] = await Promise.all([
    supabase
      .from("result_cases")
      .select(
        "id, state, urgency, test_code, owner_staff_id, current_step_due_at, opened_at, notified_at, acknowledged_at, understanding_correct, care_started_at, closed_at, closure_reason, referral_rejected_at, contact_attempts, patients(id, full_name, mrn), owner:owner_staff_id(full_name), result:result_id(value_numeric, value_text, reported_at)"
      )
      .eq("clinic_id", staff.clinic_id)
      .or(`state.neq.closed,closed_at.gte.${closedSince}`)
      .order("opened_at", { ascending: false })
      .limit(500),
    supabase
      .from("screening_results")
      .select(
        "id, test_code, value_numeric, value_text, reported_at, source, notes, suggested_urgency, unmatched_name, unmatched_identifier, patient:patient_id(id, full_name, mrn)"
      )
      .eq("clinic_id", staff.clinic_id)
      .eq("triage_status", "pending")
      .order("reported_at", { ascending: true }),
    supabase
      .from("staff")
      .select("id, full_name, role")
      .eq("clinic_id", staff.clinic_id)
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("referrals").select("status").eq("clinic_id", staff.clinic_id),
    supabase
      .from("safety_net_followups")
      .select("id, patient_id, protocol_code, closure_reason, ordered_test_code, closed_at")
      .eq("clinic_id", staff.clinic_id)
      .eq("state", "closed")
      .in("closure_reason", ["blood_test", "review_booked"])
      .gte("closed_at", followupSince)
      .order("closed_at", { ascending: false }),
  ]);

  for (const res of [casesRes, triageRes, staffRes, referralsRes, followupsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const cases = (casesRes.data ?? []) as CaseRow[];
  const triage = ((triageRes.data ?? []) as Array<Omit<TriageResult, "patient"> & { patient: Relation<TriageResult["patient"]> }>)
    .map((row) => {
      const patient = first(row.patient);
      // A follow-up closed for this test (or for a review) may be what this result continues.
      const candidates = ((followupsRes.data ?? []) as FollowupCandidateRow[]).filter((f) => f.patient_id === patient?.id);
      const candidate =
        candidates.find((f) => f.ordered_test_code === row.test_code) ?? candidates.find((f) => f.closure_reason === "review_booked") ?? null;
      return {
        ...row,
        patient,
        followupCandidate: candidate
          ? {
              id: candidate.id,
              label: getProtocol(candidate.protocol_code)?.label ?? candidate.protocol_code,
              detail: `${candidate.ordered_test_code ? `Ordered ${getTest(candidate.ordered_test_code)?.label ?? candidate.ordered_test_code}` : "Physical review booked"} · closed ${formatClinicDate(candidate.closed_at!)}`,
              match: candidate.ordered_test_code === row.test_code,
            }
          : null,
      };
    })
    .sort((left, right) => {
      if (!left.suggested_urgency || !right.suggested_urgency) {
        return left.suggested_urgency ? -1 : right.suggested_urgency ? 1 : 0;
      }
      return compareUrgency(right.suggested_urgency, left.suggested_urgency);
    });

  const asWorklistItem = (row: CaseRow) => ({ ...row, referral_rejected: !!row.referral_rejected_at });
  const counts = Object.fromEntries(
    WORKLISTS.map((key) => [
      key,
      key === "triage"
        ? triage.length
        : cases.filter((row) => matchesWorklist(asWorklistItem(row), key, staff.id, now)).length,
    ])
  ) as Record<Worklist, number>;

  const visible =
    list === "triage"
      ? []
      : cases
          .filter((row) => matchesWorklist(asWorklistItem(row), list, staff.id, now))
          .sort((left, right) => {
            const overdue = Number(isOverdue(right, now)) - Number(isOverdue(left, now));
            if (overdue !== 0) return overdue;
            const urgency = compareUrgency(right.urgency, left.urgency);
            if (urgency !== 0) return urgency;
            return (left.current_step_due_at ?? "").localeCompare(right.current_step_due_at ?? "");
          });

  const metrics = computeLoopMetrics(
    cases.map((row) => ({
      ...row,
      result_reported_at: first(row.result)?.reported_at ?? row.opened_at,
    })),
    (referralsRes.data ?? []) as Array<{ status: "sent" }>,
    now
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Care Loop</h1>
          <p className="text-sm text-muted-foreground">
            Every actionable result has an owner, a next step and an ending.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/cases/metrics" className={buttonVariants({ variant: "outline" })}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Metrics
          </Link>
          <Link href="/cases/new" className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" />
            Log result
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="To triage" value={String(counts.triage)} href="/cases?list=triage" />
        <SummaryTile label="Open cases" value={String(metrics.openCases)} href="/cases?list=open" />
        <SummaryTile
          label="Overdue"
          value={String(metrics.overdueCases)}
          href="/cases?list=overdue"
          alert={metrics.overdueCases > 0}
        />
        <SummaryTile
          label="Median time to notify"
          value={formatDuration(metrics.medianHoursToNotification)}
          href="/cases/metrics"
        />
      </div>

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]" aria-label="Worklists">
        {WORKLISTS.map((key) => (
          <Link
            key={key}
            href={`/cases?list=${key}`}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              key === list
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {WORKLIST_LABELS[key]}
            <Badge variant={key === "overdue" && counts[key] > 0 ? "destructive" : "secondary"}>{counts[key]}</Badge>
          </Link>
        ))}
      </nav>

      {list === "triage" ? (
        <TriageList
          results={triage}
          staff={(staffRes.data ?? []) as Array<{ id: string; full_name: string; role: string }>}
          canTriage={canTriageResults(staff.role)}
          currentStaffId={staff.id}
        />
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nothing in this list.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {visible.map((row) => {
            const patient = first(row.patients);
            const result = first(row.result);
            const owner = first(row.owner);
            const needsDecision = needsDoctorDecision({ state: row.state, contactAttempts: row.contact_attempts });
            return (
              <Link key={row.id} href={`/cases/${row.id}`}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{patient?.full_name ?? "Unknown patient"}</p>
                        <UrgencyBadge urgency={row.urgency} />
                        {needsDecision ? <Badge variant="destructive">Unreachable: doctor to decide</Badge> : null}
                        {row.referral_rejected_at && row.state !== "closed" ? (
                          <Badge variant="destructive">Referral declined</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {getTest(row.test_code)?.label ?? row.test_code}:{" "}
                        {result ? formatResultValue(row.test_code, { numeric: result.value_numeric, text: result.value_text }) : ""}
                        {patient ? ` · MRN ${patient.mrn}` : ""}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <StateBadge state={row.state} />
                      <p className="text-xs text-muted-foreground">
                        {row.state === "closed" && row.closed_at
                          ? `Closed ${formatClinicDate(row.closed_at)}`
                          : NEXT_ACTION_LABELS[row.state]}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Owner {owner?.full_name ?? "–"}</p>
                    <DueLabel dueAt={row.current_step_due_at} urgency={row.urgency} state={row.state} now={now} />
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

function SummaryTile({ label, value, href, alert }: { label: string; value: string; href: string; alert?: boolean }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold", alert && "text-destructive")}>{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
