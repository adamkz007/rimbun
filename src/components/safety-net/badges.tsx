import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Route } from "@/lib/safety-net/protocols";
import { CALL_REASON_LABELS, STATE_LABELS, type CallReason, type FollowupState } from "@/lib/safety-net/workflow";
import { cn } from "@/lib/utils";

const ROUTE_STYLES: Record<Route, string> = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  red: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

const ROUTE_LABELS: Record<Route, string> = { green: "Improving", amber: "Check needed", red: "Red flag" };

export function RouteBadge({ route, className }: { route: Route | null; className?: string }) {
  if (!route) return null;
  return (
    <Badge variant="outline" className={cn(ROUTE_STYLES[route], className)}>
      {ROUTE_LABELS[route]}
    </Badge>
  );
}

export function RouteDot({ route }: { route: Route }) {
  const color = route === "red" ? "bg-red-500" : route === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", color)} aria-hidden="true" />;
}

export function FollowupStateBadge({ state, callReason }: { state: FollowupState; callReason?: CallReason | null }) {
  const label =
    state === "needs_call" && callReason ? `${STATE_LABELS[state]}: ${CALL_REASON_LABELS[callReason].toLowerCase()}` : STATE_LABELS[state];
  return (
    <Badge
      variant={state === "escalated" ? "destructive" : state === "closed" ? "secondary" : "outline"}
      className="whitespace-normal text-left"
    >
      {label}
    </Badge>
  );
}

export function FollowupDue({ state, dueAt, now }: { state: FollowupState; dueAt: string | null; now?: Date }) {
  if (state === "closed" || !dueAt) return <span className="text-xs text-muted-foreground">–</span>;
  const due = new Date(dueAt);
  const distance = formatDistanceToNowStrict(due);
  const overdue = due.getTime() < (now ?? new Date()).getTime();
  const verb = state === "scheduled" ? "Check-in" : state === "awaiting_reply" || state === "answering" ? "Reply due" : "Due";
  if (!overdue) return <span className="text-xs text-muted-foreground">{verb} in {distance}</span>;
  return <span className="text-xs font-medium text-destructive">Overdue by {distance}</span>;
}

/** The prototype disclaimers, shown wherever the feature appears. */
export function PrototypeNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      Prototype. WhatsApp delivery is simulated, and the question sets are drafts that have not been clinically
      reviewed. Do not use with real patients.
    </p>
  );
}
