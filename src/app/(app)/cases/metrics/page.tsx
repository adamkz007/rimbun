import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageAccess } from "@/lib/auth";
import { getTest, TEST_CATEGORY_LABELS, type TestCategory } from "@/lib/care-loop/catalogue";
import { computeLoopMetrics, formatDuration, type MetricsCase, type MetricsReferral } from "@/lib/care-loop/metrics";
import { CLOSURE_REASON_LABELS, type ClosureReason } from "@/lib/care-loop/workflow";
import { computeFollowupMetrics, type MetricsFollowup } from "@/lib/safety-net/metrics";
import { CLOSURE_REASON_LABELS as FOLLOWUP_CLOSURE_LABELS, ESCALATION_DUE_MINUTES } from "@/lib/safety-net/workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Row = MetricsCase & { test_code: string; result: { reported_at: string } | Array<{ reported_at: string }> | null };

export default async function CareLoopMetricsPage() {
  const staff = await requirePageAccess({ module: "loop" });
  const supabase = await getSupabaseServerClient();

  const [casesRes, referralsRes, followupsRes, actionsRes] = await Promise.all([
    supabase
      .from("result_cases")
      .select(
        "state, test_code, opened_at, notified_at, acknowledged_at, understanding_correct, care_started_at, closed_at, closure_reason, current_step_due_at, result:result_id(reported_at)"
      )
      .eq("clinic_id", staff.clinic_id)
      .limit(5000),
    supabase.from("referrals").select("status").eq("clinic_id", staff.clinic_id),
    supabase
      .from("safety_net_followups")
      .select("id, state, route, sent_at, responded_at, escalated_at, closure_reason, answers")
      .eq("clinic_id", staff.clinic_id)
      .limit(5000),
    supabase
      .from("safety_net_events")
      .select("followup_id, created_at, actor:actor_staff_id(role)")
      .eq("clinic_id", staff.clinic_id)
      .in("event_type", ["decision", "closed"])
      .not("actor_staff_id", "is", null)
      .limit(20000),
  ]);
  if (followupsRes.error) throw new Error(followupsRes.error.message);
  if (actionsRes.error) throw new Error(actionsRes.error.message);
  const followupMetrics = computeFollowupMetrics(
    (followupsRes.data ?? []) as MetricsFollowup[],
    ((actionsRes.data ?? []) as Array<{ followup_id: string; created_at: string; actor: { role: string } | Array<{ role: string }> | null }>)
      .filter((action) => (Array.isArray(action.actor) ? action.actor[0]?.role : action.actor?.role) === "doctor")
      .map(({ followup_id, created_at }) => ({ followup_id, created_at }))
  );
  const closureMax = Math.max(1, ...Object.values(followupMetrics.closures).map((count) => count ?? 0));
  const routeTotal = followupMetrics.routeMix.red + followupMetrics.routeMix.amber + followupMetrics.routeMix.green;
  if (casesRes.error) throw new Error(casesRes.error.message);
  if (referralsRes.error) throw new Error(referralsRes.error.message);

  const rows = ((casesRes.data ?? []) as Row[]).map((row) => {
    const result = Array.isArray(row.result) ? row.result[0] : row.result;
    return { ...row, result_reported_at: result?.reported_at ?? row.opened_at };
  });
  const metrics = computeLoopMetrics(rows, (referralsRes.data ?? []) as MetricsReferral[]);

  const byCategory = new Map<TestCategory, { open: number; closed: number }>();
  for (const row of rows) {
    const category = getTest(row.test_code)?.category;
    if (!category) continue;
    const entry = byCategory.get(category) ?? { open: 0, closed: 0 };
    if (row.state === "closed") entry.closed += 1;
    else entry.open += 1;
    byCategory.set(category, entry);
  }

  const ageMax = Math.max(1, metrics.openByAge.upTo7, metrics.openByAge.from8To30, metrics.openByAge.over30);
  const percent = (value: number | null) => (value === null ? "–" : `${value}%`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Loop-closure metrics</h1>
          <p className="text-sm text-muted-foreground">
            {metrics.totalCases} case{metrics.totalCases === 1 ? "" : "s"} from actionable results. Times are medians.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Result to notification" value={formatDuration(metrics.medianHoursToNotification)} />
        <Metric label="Notification to acknowledgement" value={formatDuration(metrics.medianHoursToAcknowledgement)} />
        <Metric
          label="Result to care"
          value={metrics.medianDaysToCare === null ? "–" : `${Math.round(metrics.medianDaysToCare)} d`}
        />
        <Metric label="Patients who understood the next step" value={percent(metrics.understandingPercent)} />
        <Metric
          label="Referrals completed"
          value={percent(metrics.referralCompletionPercent)}
          detail={`${metrics.referralsSent} sent`}
        />
        <Metric label="Referrals declined" value={percent(metrics.referralRejectionPercent)} />
        <Metric label="Open now" value={String(metrics.openCases)} detail={`${metrics.overdueCases} overdue`} />
        <Metric
          label="Closed with care evidence"
          value={percent(metrics.closedWithEvidencePercent)}
          detail={`${metrics.closedCases} closed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unresolved results by age</CardTitle>
            <CardDescription>Open cases, days since the case was opened.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "0–7 days", value: metrics.openByAge.upTo7 },
              { label: "8–30 days", value: metrics.openByAge.from8To30 },
              { label: "Over 30 days", value: metrics.openByAge.over30 },
            ].map((bucket) => (
              <div key={bucket.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{bucket.label}</span>
                  <span className="font-medium">{bucket.value}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(bucket.value / ageMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Drop-off reasons</CardTitle>
            <CardDescription>Cases closed without completed care.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.keys(metrics.dropOffReasons).length === 0 ? (
              <p className="text-muted-foreground">None recorded.</p>
            ) : (
              Object.entries(metrics.dropOffReasons).map(([reason, count]) => (
                <div key={reason} className="flex justify-between">
                  <span>{CLOSURE_REASON_LABELS[reason as ClosureReason]}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By pathway</CardTitle>
            <CardDescription>Open and closed cases per test group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {byCategory.size === 0 ? (
              <p className="text-muted-foreground">No cases yet.</p>
            ) : (
              [...byCategory.entries()].map(([category, counts]) => (
                <div key={category} className="flex justify-between gap-3">
                  <span>{TEST_CATEGORY_LABELS[category]}</span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{counts.open}</span> open · {counts.closed} closed
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Safety-net follow-ups</h2>
          <p className="text-sm text-muted-foreground">
            {followupMetrics.sent} WhatsApp check-in{followupMetrics.sent === 1 ? "" : "s"} sent after visits with an
            unconfirmed cause. No comparison with an earlier period is shown until there is real data for one.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Check-ins answered on WhatsApp" value={percent(followupMetrics.answeredPercent)} detail={`${followupMetrics.sent} sent`} />
          <Metric
            label="Red answer to a doctor's decision"
            value={followupMetrics.medianMinutesRedToDecision === null ? "–" : `${Math.round(followupMetrics.medianMinutesRedToDecision)} min`}
            detail={`Target ${ESCALATION_DUE_MINUTES} min · ${followupMetrics.redDecisions} red`}
          />
          <Metric
            label="Knew what to do next"
            value={percent(followupMetrics.confidencePercent)}
            detail={`${followupMetrics.confidenceAnswers} answered`}
          />
          <Metric
            label="Route mix"
            value={routeTotal === 0 ? "–" : `${followupMetrics.routeMix.red} / ${followupMetrics.routeMix.amber} / ${followupMetrics.routeMix.green}`}
            detail="High / medium / low risk"
          />
        </div>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-sm">Follow-ups closed, by reason</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(followupMetrics.closures).length === 0 ? (
              <p className="text-sm text-muted-foreground">None closed yet.</p>
            ) : (
              Object.entries(followupMetrics.closures)
                .sort(([, left], [, right]) => (right ?? 0) - (left ?? 0))
                .map(([reason, count]) => (
                  <div key={reason} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{FOLLOWUP_CLOSURE_LABELS[reason as keyof typeof FOLLOWUP_CLOSURE_LABELS]}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${((count ?? 0) / closureMax) * 100}%` }} />
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
