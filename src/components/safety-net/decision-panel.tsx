"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, FlaskConical, MessageSquare, RefreshCw, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideFollowup, requestRimbunRead } from "@/lib/actions/safety-net-actions";
import type { ActionResult } from "@/lib/care-loop/result";
import type { Route } from "@/lib/safety-net/protocols";
import { isHighRisk, type Decision, type FollowupState } from "@/lib/safety-net/workflow";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/types/database";

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

function useRun() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error("Action failed", result.error);
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  }
  return { isPending, run };
}

// ---- Rimbun's read ----

export type ReadView = { summary: string; suggested: string; model: string; at: string; stale: boolean };

export function RimbunReadCard({
  followupId,
  read,
  ruleRead,
  hasAnswers,
}: {
  followupId: string;
  read: ReadView | null;
  /** A rule-based read (all-green answers), shown when Claude hasn't been asked. */
  ruleRead: { summary: string; suggested: string } | null;
  hasAnswers: boolean;
}) {
  const { isPending, run } = useRun();
  const [error, setError] = useState<string | null>(null);
  const shown = read ?? ruleRead;

  function ask() {
    setError(null);
    run(
      async () => {
        const result = await requestRimbunRead(followupId);
        if (!result.ok) setError(result.error);
        return result.ok ? result : { ok: true as const, data: null };
      },
      "Read updated"
    );
  }

  if (!hasAnswers) return null;

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-50">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="h-4 w-4" />
          Rimbun&apos;s read
        </h2>
        <Button size="sm" variant="outline" className="h-7 bg-transparent" disabled={isPending} onClick={ask}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Reading..." : read ? "Ask again" : "Ask Claude"}
        </Button>
      </div>
      {shown ? (
        <div className="mt-2 space-y-1.5">
          <p>{shown.summary}</p>
          <p className="font-semibold">Suggested: {shown.suggested.replace(/^Suggested:\s*/i, "")}</p>
          <p className="text-xs opacity-80">A suggestion only. A doctor makes the decision.</p>
          <p className="text-[11px] opacity-70">
            {read
              ? `Claude (${read.model}) · ${read.at}${read.stale ? " · new answers since, ask again" : ""}`
              : "From the routing rules. Ask Claude for a fuller read."}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs opacity-80">
          Claude can summarise what the answers rule out and raise, and suggest a next step. A doctor decides.
        </p>
      )}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

// ---- Doctor decision ----

export type DecisionView = {
  id: string;
  state: FollowupState;
  route: Route | null;
  closed: { label: string; note: string | null; by: string | null; at: string } | null;
  reviewAt: string | null;
  orderedTest: string | null;
  lastDecision: { label: string; by: string; at: string } | null;
};

function defaultReviewTime() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

export function DecisionCard({
  followup,
  role,
  tests,
  messageWindowOpen,
}: {
  followup: DecisionView;
  role: StaffRole;
  tests: Array<{ code: string; label: string; group: string }>;
  messageWindowOpen: boolean;
}) {
  const { isPending, run } = useRun();
  const [mode, setMode] = useState<Exclude<Decision, "approve_closure" | "keep_open"> | null>(null);
  const [reviewAt, setReviewAt] = useState(defaultReviewTime);
  const [testCode, setTestCode] = useState(tests[0]?.code ?? "");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const isDoctor = role === "doctor";
  const highRisk = isHighRisk(followup);

  function decide(decision: Decision, success: string) {
    run(
      () =>
        decideFollowup({
          followupId: followup.id,
          decision,
          reviewAt: decision === "book_review" ? new Date(reviewAt).toISOString() : null,
          testCode: decision === "order_test" ? testCode : null,
          message: decision === "message_patient" ? message : null,
          note,
        }),
      success,
      () => {
        setMode(null);
        setNote("");
        setMessage("");
      }
    );
  }

  const outcomes = (
    <div className="space-y-1.5 border-t pt-3 text-sm">
      {followup.reviewAt ? (
        <p className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Review booked
          </Badge>
          {followup.reviewAt}
        </p>
      ) : null}
      {followup.orderedTest ? (
        <p className="flex items-center gap-2">
          <Badge variant="outline">Ordered</Badge>
          {followup.orderedTest}
        </p>
      ) : null}
      {followup.lastDecision ? (
        <p className="text-xs text-muted-foreground">
          {followup.lastDecision.label} by {followup.lastDecision.by} · {followup.lastDecision.at}
        </p>
      ) : null}
    </div>
  );

  if (followup.closed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Doctor decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Closed</Badge>
              <span className="font-medium">{followup.closed.label}</span>
            </p>
            {followup.closed.note ? <p className="text-xs text-muted-foreground">{followup.closed.note}</p> : null}
            <p className="text-xs text-muted-foreground">
              {followup.closed.by
                ? `${followup.state === "closed" && followup.closed.label.startsWith("Minor illness") ? "Signed off" : "Closed"} by ${followup.closed.by} · ${followup.closed.at}`
                : `Closed automatically on reviewed answers · ${followup.closed.at}`}
            </p>
          </div>
          {followup.reviewAt || followup.orderedTest ? outcomes : null}
        </CardContent>
      </Card>
    );
  }

  if (followup.state === "ready_to_close") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sign-off</CardTitle>
          <CardDescription>Every answer was in the expected range. A doctor approves the closure or keeps it open.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isDoctor ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="signoff-note">Note (optional)</Label>
                <Textarea id="signoff-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isPending} onClick={() => decide("approve_closure", "Closure approved")}>
                  <Check className="mr-1.5 h-4 w-4" />
                  Approve closure
                </Button>
                <Button variant="outline" disabled={isPending} onClick={() => decide("keep_open", "Kept open: a nurse will call")}>
                  Keep open
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for a doctor&apos;s sign-off.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (followup.state === "scheduled") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Doctor decision</CardTitle>
          <CardDescription>The check-in hasn&apos;t been sent yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const canAct = isDoctor || !highRisk;
  const buttons: Array<{ key: NonNullable<typeof mode>; label: string; icon: typeof Check; doctorOnly: boolean }> = [
    { key: "book_review", label: "Book physical review", icon: CalendarClock, doctorOnly: false },
    { key: "order_test", label: "Order test", icon: FlaskConical, doctorOnly: true },
    { key: "message_patient", label: "Message patient", icon: MessageSquare, doctorOnly: false },
    { key: "close_minor", label: "Close as minor illness", icon: X, doctorOnly: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Doctor decision</CardTitle>
        {!canAct ? <CardDescription className="text-destructive">High risk: a doctor decides. You can still call and log notes.</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          {buttons.map(({ key, label, icon: Icon, doctorOnly }) => {
            const allowed = canAct && (!doctorOnly || isDoctor);
            const windowClosed = key === "message_patient" && !messageWindowOpen;
            return (
              <Button
                key={key}
                variant={mode === key ? "default" : "outline"}
                disabled={isPending || !allowed || windowClosed}
                title={
                  windowClosed
                    ? "WhatsApp only delivers a free message within 24 hours of the patient's last reply. Call instead."
                    : !allowed
                      ? "A doctor makes this decision."
                      : undefined
                }
                onClick={() => setMode(mode === key ? null : key)}
              >
                <Icon className="mr-1.5 h-4 w-4" />
                {label}
              </Button>
            );
          })}
          {!messageWindowOpen ? (
            <p className="text-[11px] text-muted-foreground">
              Message patient opens when the patient has replied in the last 24 hours (WhatsApp&apos;s rule).
            </p>
          ) : null}
        </div>

        {mode ? (
          <div className={cn("space-y-2 rounded-md border p-3")}>
            {mode === "book_review" ? (
              <div className="space-y-1.5">
                <Label htmlFor="review-at">Review date and time</Label>
                <Input id="review-at" type="datetime-local" value={reviewAt} onChange={(event) => setReviewAt(event.target.value)} />
              </div>
            ) : null}
            {mode === "order_test" ? (
              <div className="space-y-1.5">
                <Label htmlFor="order-test">Test</Label>
                <select id="order-test" className={SELECT_CLASS} value={testCode} onChange={(event) => setTestCode(event.target.value)}>
                  {tests.map((test) => (
                    <option key={test.code} value={test.code}>
                      {test.label} ({test.group})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  When the result comes back, log it in Care Loop: the case links back to this follow-up.
                </p>
              </div>
            ) : null}
            {mode === "message_patient" ? (
              <div className="space-y-1.5">
                <Label htmlFor="patient-message">Message (sent on WhatsApp as you write it)</Label>
                <Textarea id="patient-message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="decision-note">{mode === "close_minor" && highRisk ? "Note (required: red flag reported)" : "Note (optional)"}</Label>
              <Textarea id="decision-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={() =>
                decide(
                  mode,
                  mode === "book_review"
                    ? "Review booked"
                    : mode === "order_test"
                      ? "Test ordered"
                      : mode === "message_patient"
                        ? "Message sent"
                        : "Closed as minor illness"
                )
              }
            >
              {mode === "message_patient" ? "Send message" : "Confirm decision"}
            </Button>
          </div>
        ) : null}

        {followup.lastDecision ? outcomes : null}
      </CardContent>
    </Card>
  );
}
