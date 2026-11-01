"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatClinicDateTime } from "@/lib/care-loop/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fileResultAsNormal, matchResultToPatient, openCase } from "@/lib/actions/care-loop-actions";
import {
  formatResultValue,
  getTest,
  NEXT_STEP_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  type NextStep,
  type Urgency,
} from "@/lib/care-loop/catalogue";
import { unwrap, type ActionResult } from "@/lib/care-loop/result";
import { toast } from "@/lib/toast";
import { UrgencyBadge } from "./case-badges";
import { PatientPicker, type PickedPatient } from "./patient-picker";

export type TriageResult = {
  id: string;
  test_code: string;
  value_numeric: number | null;
  value_text: string | null;
  reported_at: string;
  source: string | null;
  notes: string | null;
  suggested_urgency: Urgency | null;
  unmatched_name: string | null;
  unmatched_identifier: string | null;
  patient: PickedPatient | null;
};

export type StaffOption = { id: string; full_name: string; role: string };

const NEXT_STEPS = Object.keys(NEXT_STEP_LABELS) as NextStep[];

export function TriageList({
  results,
  staff,
  canTriage,
  currentStaffId,
}: {
  results: TriageResult[];
  staff: StaffOption[];
  canTriage: boolean;
  currentStaffId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<TriageResult | null>(null);
  const [matchFor, setMatchFor] = useState<TriageResult | null>(null);
  const [urgency, setUrgency] = useState<Urgency>("routine");
  const [nextStep, setNextStep] = useState<NextStep>("clinic_review");
  const [ownerId, setOwnerId] = useState(currentStaffId);
  const [note, setNote] = useState("");
  const [matchPatient, setMatchPatient] = useState<PickedPatient | null>(null);

  function run(action: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) {
    startTransition(async () => {
      try {
        unwrap((await action()) as ActionResult<unknown>);
        toast.success(success);
        after?.();
        router.refresh();
      } catch (error) {
        toast.error("Action failed", error instanceof Error ? error.message : undefined);
      }
    });
  }

  function startOpenCase(result: TriageResult) {
    const test = getTest(result.test_code);
    setUrgency(result.suggested_urgency ?? "routine");
    setNextStep(test?.nextStep ?? "clinic_review");
    setOwnerId(currentStaffId);
    setNote("");
    setOpenFor(result);
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No results waiting for triage.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const test = getTest(result.test_code);
        return (
          <Card key={result.id}>
            <CardContent className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {result.patient?.full_name ?? `${result.unmatched_name} (unmatched)`}
                  </p>
                  {result.suggested_urgency ? (
                    <UrgencyBadge urgency={result.suggested_urgency} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Within normal range</span>
                  )}
                </div>
                <p className="text-sm">
                  {test?.label ?? result.test_code}:{" "}
                  <span className="font-medium">
                    {formatResultValue(result.test_code, { numeric: result.value_numeric, text: result.value_text })}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.patient ? `MRN ${result.patient.mrn} · ` : result.unmatched_identifier ? `ID ${result.unmatched_identifier} · ` : ""}
                  Logged {formatClinicDateTime(result.reported_at)}
                  {result.source ? ` · ${result.source}` : ""}
                </p>
                {result.notes ? <p className="text-xs text-muted-foreground">{result.notes}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {!result.patient ? (
                  <Button variant="outline" size="sm" onClick={() => { setMatchPatient(null); setMatchFor(result); }}>
                    Match patient
                  </Button>
                ) : null}
                {canTriage ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => fileResultAsNormal(result.id), "Filed as normal")}
                    >
                      File as normal
                    </Button>
                    <Button size="sm" disabled={isPending || !result.patient} onClick={() => startOpenCase(result)}>
                      Open case
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!openFor} onOpenChange={(open) => !open && setOpenFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Open a follow-up case</DialogTitle>
          </DialogHeader>
          {openFor ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {openFor.patient?.full_name} · {getTest(openFor.test_code)?.label}:{" "}
                {formatResultValue(openFor.test_code, { numeric: openFor.value_numeric, text: openFor.value_text })}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="triage-urgency">Urgency</Label>
                  <select
                    id="triage-urgency"
                    value={urgency}
                    onChange={(event) => setUrgency(event.target.value as Urgency)}
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    {URGENCIES.map((value) => (
                      <option key={value} value={value}>
                        {URGENCY_LABELS[value]}
                        {value === openFor.suggested_urgency ? " (suggested)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="triage-owner">Owner</Label>
                  <select
                    id="triage-owner"
                    value={ownerId}
                    onChange={(event) => setOwnerId(event.target.value)}
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} ({member.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="triage-next-step">Next step for the patient</Label>
                <select
                  id="triage-next-step"
                  value={nextStep}
                  onChange={(event) => setNextStep(event.target.value as NextStep)}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  {NEXT_STEPS.map((value) => (
                    <option key={value} value={value}>
                      {NEXT_STEP_LABELS[value].en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="triage-note">Clinical note</Label>
                <Textarea
                  id="triage-note"
                  rows={3}
                  placeholder="e.g. New diabetes range, no prior HbA1c. Review in clinic and start lifestyle advice."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <Button
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const { caseId } = unwrap(await openCase({
                        resultId: openFor.id,
                        urgency,
                        nextStep,
                        nextStepNote: note,
                        ownerStaffId: ownerId,
                      }));
                      toast.success("Case opened");
                      // Navigate without a refresh: a refresh here would cancel the push.
                      router.push(`/cases/${caseId}`);
                    } catch (error) {
                      toast.error("Action failed", error instanceof Error ? error.message : undefined);
                    }
                  })
                }
              >
                Open case
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!matchFor} onOpenChange={(open) => !open && setMatchFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Match result to a patient</DialogTitle>
          </DialogHeader>
          {matchFor ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Report name: {matchFor.unmatched_name}
                {matchFor.unmatched_identifier ? ` · ${matchFor.unmatched_identifier}` : ""}
              </p>
              <PatientPicker id="match-patient" value={matchPatient} onChange={setMatchPatient} />
              <Button
                disabled={isPending || !matchPatient}
                onClick={() =>
                  run(
                    () => matchResultToPatient(matchFor.id, matchPatient!.id),
                    "Result matched",
                    () => setMatchFor(null)
                  )
                }
              >
                Match
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
