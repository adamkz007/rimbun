import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CAUSE_LEVEL_LABELS, type CauseLevel, type Route } from "@/lib/safety-net/protocols";
import {
  CALL_REASON_LABELS,
  isHighRisk,
  RISK_LABELS,
  STATE_LABELS,
  type CallReason,
  type FollowupState,
} from "@/lib/safety-net/workflow";
import { cn } from "@/lib/utils";

const ROUTE_STYLES: Record<Route, string> = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  red: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

/** The route shown as risk: red "High risk", amber "Medium risk", green "Low risk". One scale. */
export function RiskBadge({
  route,
  state,
  className,
}: {
  route: Route | null;
  state: FollowupState;
  className?: string;
}) {
  const effective: Route | null = isHighRisk({ state, route }) ? "red" : route;
  if (!effective) {
    if (state === "scheduled" || state === "closed") return null;
    return (
      <Badge variant="outline" className={className}>
        No reply yet
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(ROUTE_STYLES[effective], className)}>
      {RISK_LABELS[effective]}
    </Badge>
  );
}

export function RouteDot({ route }: { route: Route }) {
  const color = route === "red" ? "bg-red-500" : route === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", color)} aria-hidden="true" />;
}

export function FollowupStateBadge({ state }: { state: FollowupState }) {
  return (
    <Badge
      variant={state === "escalated" ? "destructive" : state === "closed" ? "secondary" : "outline"}
      className="whitespace-normal text-left"
    >
      {STATE_LABELS[state]}
    </Badge>
  );
}

/** The line under the state: why a nurse is calling, or what the doctor needs to do. */
export function stateDetail(state: FollowupState, callReason: CallReason | null) {
  if (state === "needs_call" && callReason) return CALL_REASON_LABELS[callReason];
  if (state === "ready_to_close") return "Needs a doctor's sign-off";
  if (state === "escalated") return "A doctor needs to decide";
  return null;
}

const LEVEL_STYLES: Record<CauseLevel, string> = {
  likely: "",
  watch: "",
  possible: "",
  raised: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ruled_out: "text-muted-foreground line-through decoration-1",
};

export function CauseLevelBadge({ level }: { level: CauseLevel }) {
  return (
    <Badge variant="outline" className={cn("font-normal", LEVEL_STYLES[level])}>
      {CAUSE_LEVEL_LABELS[level]}
    </Badge>
  );
}

export function FollowupDue({ state, dueAt, now }: { state: FollowupState; dueAt: string | null; now?: Date }) {
  if (state === "closed" || !dueAt) return <span className="text-xs text-muted-foreground">–</span>;
  const due = new Date(dueAt);
  const distance = formatDistanceToNowStrict(due);
  const overdue = due.getTime() < (now ?? new Date()).getTime();
  const verb =
    state === "scheduled"
      ? "Check-in"
      : state === "awaiting_reply" || state === "answering"
        ? "Reply due"
        : state === "escalated"
          ? "Respond"
          : "Due";
  if (!overdue) return <span className="text-xs text-muted-foreground">{verb} in {distance}</span>;
  return <span className="text-xs font-medium text-destructive">Overdue by {distance}</span>;
}

/** The prototype disclaimers, shown wherever the feature appears. */
export function PrototypeNotice({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground", className)}>
      Prototype. WhatsApp delivery is simulated, and the question sets are drafts that have not been clinically
      reviewed. Do not use with real patients.
    </p>
  );
}
