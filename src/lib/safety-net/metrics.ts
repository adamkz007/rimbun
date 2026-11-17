import { median } from "../care-loop/metrics.ts";
import type { Route } from "./protocols.ts";
import type { ClosureReason, FollowupState } from "./workflow.ts";

// Safety-net follow-up measures, computed from follow-up records and their
// events so every number traces back to real check-ins.

export type MetricsFollowup = {
  id: string;
  state: FollowupState;
  route: Route | null;
  sent_at: string | null;
  responded_at: string | null;
  escalated_at: string | null;
  closure_reason: ClosureReason | null;
  answers: Record<string, string>;
};

/** Staff actions that count as a doctor (or staff) acting on a follow-up. */
export type MetricsAction = { followup_id: string; created_at: string };

const MINUTE = 60 * 1000;

function percent(part: number, whole: number) {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

export function computeFollowupMetrics(followups: MetricsFollowup[], actions: MetricsAction[]) {
  const sent = followups.filter((item) => item.sent_at);
  const answered = sent.filter((item) => item.responded_at);

  const routeMix: Record<Route, number> = { green: 0, amber: 0, red: 0 };
  for (const item of followups) if (item.route) routeMix[item.route] += 1;

  const actionsByFollowup = new Map<string, number[]>();
  for (const action of actions) {
    const list = actionsByFollowup.get(action.followup_id) ?? [];
    list.push(new Date(action.created_at).getTime());
    actionsByFollowup.set(action.followup_id, list);
  }
  const redToDecision: number[] = [];
  for (const item of followups) {
    if (!item.escalated_at) continue;
    const start = new Date(item.escalated_at).getTime();
    const next = (actionsByFollowup.get(item.id) ?? []).filter((time) => time >= start).sort((a, b) => a - b)[0];
    if (next !== undefined) redToDecision.push((next - start) / MINUTE);
  }

  const closures: Partial<Record<ClosureReason, number>> = {};
  for (const item of followups) {
    if (item.state === "closed" && item.closure_reason) {
      closures[item.closure_reason] = (closures[item.closure_reason] ?? 0) + 1;
    }
  }

  const confidenceAnswers = followups.map((item) => item.answers?.next_steps).filter((value): value is string => !!value);

  return {
    total: followups.length,
    sent: sent.length,
    answeredPercent: percent(answered.length, sent.length),
    routeMix,
    medianMinutesRedToDecision: median(redToDecision),
    redDecisions: redToDecision.length,
    closures,
    confidencePercent: percent(confidenceAnswers.filter((value) => value === "yes").length, confidenceAnswers.length),
    confidenceAnswers: confidenceAnswers.length,
  };
}

export type FollowupMetrics = ReturnType<typeof computeFollowupMetrics>;
