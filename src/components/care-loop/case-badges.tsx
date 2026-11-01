import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { URGENCY_LABELS, type Urgency } from "@/lib/care-loop/catalogue";
import {
  CASE_STATE_LABELS,
  ESCALATION_LABELS,
  escalationTier,
  type CaseState,
} from "@/lib/care-loop/workflow";
import { cn } from "@/lib/utils";

const URGENCY_STYLES: Record<Urgency, string> = {
  routine: "border-border bg-transparent text-foreground",
  soon: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  urgent: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  critical: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

export function UrgencyBadge({ urgency, className }: { urgency: Urgency; className?: string }) {
  return (
    <Badge variant="outline" className={cn(URGENCY_STYLES[urgency], className)}>
      {URGENCY_LABELS[urgency]}
    </Badge>
  );
}

export function StateBadge({ state }: { state: CaseState }) {
  return <Badge variant={state === "closed" ? "secondary" : "outline"}>{CASE_STATE_LABELS[state]}</Badge>;
}

/** "Due in 5 h" / "Overdue by 2 d" plus the escalation tier when overdue. */
export function DueLabel({
  dueAt,
  urgency,
  state,
  now,
}: {
  dueAt: string | null;
  urgency: Urgency;
  state: CaseState;
  now?: Date;
}) {
  if (state === "closed" || !dueAt) return <span className="text-xs text-muted-foreground">–</span>;
  const reference = now ?? new Date();
  const due = new Date(dueAt);
  const tier = escalationTier(due, urgency, reference);
  const distance = formatDistanceToNowStrict(due);

  if (tier === "none") {
    return <span className="text-xs text-muted-foreground">Due in {distance}</span>;
  }

  return (
    <span className="flex flex-col text-xs">
      <span className="font-medium text-destructive">Overdue by {distance}</span>
      <span className="text-muted-foreground">{ESCALATION_LABELS[tier]}</span>
    </span>
  );
}
