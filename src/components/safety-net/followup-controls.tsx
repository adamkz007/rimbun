"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FastForward, Phone, PhoneCall, PlayCircle, RefreshCw, Siren, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/care-loop/result";
import {
  closeFollowup,
  escalateFollowup,
  fastForwardFollowup,
  logFollowupCall,
  runDueFollowups,
  sendCheckInNow,
} from "@/lib/actions/safety-net-actions";
import { toast } from "@/lib/toast";
import {
  CLOSURE_REASON_LABELS,
  CLOSURE_REASONS,
  type ClosureReason,
  type FollowupState,
} from "@/lib/safety-net/workflow";
import type { Route } from "@/lib/safety-net/protocols";
import type { StaffRole } from "@/types/database";

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

function useAction() {
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

export function RunDueButton() {
  const { isPending, run } = useAction();
  return (
    <Button variant="outline" disabled={isPending} onClick={() => run(runDueFollowups, "Scheduler ran")}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Run due check-ins
    </Button>
  );
}

export function FollowupActions({
  followup,
  role,
  simulatorUrl,
}: {
  followup: { id: string; state: FollowupState; route: Route | null; call_attempts: number };
  role: StaffRole;
  simulatorUrl: string | null;
}) {
  const { isPending, run } = useAction();
  const [dialog, setDialog] = useState<"call" | "escalate" | "close" | null>(null);
  const [outcome, setOutcome] = useState<"reached" | "no_answer" | "wrong_number">("reached");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<ClosureReason>("sent_to_emergency");
  const closed = followup.state === "closed";
  const isDoctor = role === "doctor";
  const needsDoctor = followup.state === "escalated" || followup.route === "red";
  // Review, test and minor-illness closures go through the decision card.
  const reasons = CLOSURE_REASONS.filter((value) =>
    value === "cancelled" ? followup.state === "scheduled" : value === "sent_to_emergency" || value === "unreachable"
  );

  function open(kind: "call" | "escalate" | "close") {
    setNote("");
    setReason(followup.state === "scheduled" ? "cancelled" : "sent_to_emergency");
    setDialog(kind);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Calls and other outcomes</CardTitle>
          {needsDoctor && !closed ? (
            <CardDescription className="text-destructive">Red flag: a doctor must review and close this.</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2">
          {!closed ? (
            <>
              <Button variant="outline" disabled={isPending} onClick={() => open("call")}>
                <PhoneCall className="mr-2 h-4 w-4" />
                Log a call
              </Button>
              {followup.state !== "escalated" && followup.state !== "scheduled" ? (
                <Button variant="outline" disabled={isPending} onClick={() => open("escalate")}>
                  <Siren className="mr-2 h-4 w-4" />
                  Escalate to doctor
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={isPending || (followup.state !== "scheduled" && !isDoctor)}
                onClick={() => open("close")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {followup.state === "scheduled" ? "Cancel check-in" : "Emergency or unreachable"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This follow-up is closed.</p>
          )}
        </CardContent>
      </Card>

      {simulatorUrl ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Prototype controls</CardTitle>
            <CardDescription>Stand-ins for the patient&apos;s phone and for time passing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a
              href={simulatorUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Open patient&apos;s phone (simulated)
            </a>
            {followup.state === "scheduled" ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => sendCheckInNow(followup.id), "Check-in sent")}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Send check-in now
              </Button>
            ) : null}
            {followup.state === "awaiting_reply" || followup.state === "answering" ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => fastForwardFollowup(followup.id, 6), "Moved 6 hours ahead")}
              >
                <FastForward className="mr-2 h-4 w-4" />
                Skip 6 hours (no reply)
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dialog === "call"} onOpenChange={(value) => !value && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log a call</DialogTitle>
            <DialogDescription>
              {followup.call_attempts} unanswered call{followup.call_attempts === 1 ? "" : "s"} so far.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="call-outcome">Outcome</Label>
              <select
                id="call-outcome"
                className={SELECT_CLASS}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as typeof outcome)}
              >
                <option value="reached">Spoke to the patient</option>
                <option value="no_answer">No answer</option>
                <option value="wrong_number">Wrong number</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="call-note">Note</Label>
              <Textarea id="call-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </div>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={() =>
                run(() => logFollowupCall({ followupId: followup.id, outcome, note }), "Call logged", () => setDialog(null))
              }
            >
              <Phone className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "escalate"} onOpenChange={(value) => !value && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escalate to a doctor</DialogTitle>
            <DialogDescription>The follow-up moves to the top of the list as a doctor alert.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="escalate-note">Why is a doctor needed?</Label>
            <Textarea id="escalate-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            <Button
              variant="destructive"
              className="w-full"
              disabled={isPending}
              onClick={() => run(() => escalateFollowup(followup.id, note), "Doctor alerted", () => setDialog(null))}
            >
              Escalate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "close"} onOpenChange={(value) => !value && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{followup.state === "scheduled" ? "Cancel check-in" : "Close: emergency or unreachable"}</DialogTitle>
            <DialogDescription>
              Reviews, tests and minor-illness closures are in the Doctor decision card. Emergency referrals and
              unreachable patients need a doctor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="close-reason">Outcome</Label>
              <select
                id="close-reason"
                className={SELECT_CLASS}
                value={reason}
                onChange={(event) => setReason(event.target.value as ClosureReason)}
              >
                {reasons.map((value) => (
                  <option key={value} value={value}>
                    {CLOSURE_REASON_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-note">Note</Label>
              <Textarea id="close-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </div>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={() =>
                run(() => closeFollowup({ followupId: followup.id, reason, note }), "Follow-up closed", () => setDialog(null))
              }
            >
              Close follow-up
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
