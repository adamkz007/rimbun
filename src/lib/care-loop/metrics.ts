import type { ClosureReason } from "./workflow.ts";
import { isOverdue, type CaseState } from "./workflow.ts";

// Loop-closure measures, computed from case milestone timestamps so every
// number traces back to real cases.

export type MetricsCase = {
  state: CaseState;
  result_reported_at: string;
  opened_at: string;
  notified_at: string | null;
  acknowledged_at: string | null;
  understanding_correct: boolean | null;
  care_started_at: string | null;
  closed_at: string | null;
  closure_reason: ClosureReason | null;
  current_step_due_at: string | null;
};

export type MetricsReferral = {
  status: "sent" | "viewed" | "accepted" | "rejected" | "booked" | "attended";
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function elapsed(from: string | null, to: string | null, unit: number) {
  if (!from || !to) return null;
  const value = (new Date(to).getTime() - new Date(from).getTime()) / unit;
  return value >= 0 ? value : null;
}

function present(values: Array<number | null>) {
  return values.filter((value): value is number => value !== null);
}

function percent(part: number, whole: number) {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

export function computeLoopMetrics(
  cases: MetricsCase[],
  referrals: MetricsReferral[],
  now: Date = new Date()
) {
  const open = cases.filter((item) => item.state !== "closed");
  const closed = cases.filter((item) => item.state === "closed");
  const acknowledged = cases.filter((item) => item.understanding_correct !== null);

  const openByAge = { upTo7: 0, from8To30: 0, over30: 0 };
  for (const item of open) {
    const ageDays = (now.getTime() - new Date(item.opened_at).getTime()) / DAY;
    if (ageDays <= 7) openByAge.upTo7 += 1;
    else if (ageDays <= 30) openByAge.from8To30 += 1;
    else openByAge.over30 += 1;
  }

  const dropOffReasons: Partial<Record<ClosureReason, number>> = {};
  for (const item of closed) {
    if (item.closure_reason && item.closure_reason !== "completed" && item.closure_reason !== "resolved_on_repeat") {
      dropOffReasons[item.closure_reason] = (dropOffReasons[item.closure_reason] ?? 0) + 1;
    }
  }

  const referralsSent = referrals.length;
  const referralsAttended = referrals.filter((item) => item.status === "attended").length;
  const referralsRejected = referrals.filter((item) => item.status === "rejected").length;
  const closedWithEvidence = closed.filter(
    (item) => item.closure_reason === "completed" || item.closure_reason === "resolved_on_repeat"
  ).length;

  return {
    totalCases: cases.length,
    openCases: open.length,
    overdueCases: open.filter((item) => isOverdue(item, now)).length,
    openByAge,
    medianHoursToNotification: median(
      present(cases.map((item) => elapsed(item.result_reported_at, item.notified_at, HOUR)))
    ),
    medianHoursToAcknowledgement: median(
      present(cases.map((item) => elapsed(item.notified_at, item.acknowledged_at, HOUR)))
    ),
    medianDaysToCare: median(
      present(cases.map((item) => elapsed(item.result_reported_at, item.care_started_at, DAY)))
    ),
    referralsSent,
    referralCompletionPercent: percent(referralsAttended, referralsSent),
    referralRejectionPercent: percent(referralsRejected, referralsSent),
    closedCases: closed.length,
    closedWithEvidencePercent: percent(closedWithEvidence, closed.length),
    dropOffReasons,
    understandingPercent: percent(
      acknowledged.filter((item) => item.understanding_correct).length,
      acknowledged.length
    ),
  };
}

export type LoopMetrics = ReturnType<typeof computeLoopMetrics>;

export function formatDuration(hours: number | null) {
  if (hours === null) return "–";
  if (hours < 1) return "< 1 h";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}
