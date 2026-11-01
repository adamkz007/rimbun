"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enterResult } from "@/lib/actions/care-loop-actions";
import {
  suggestUrgency,
  TEST_CATALOGUE,
  TEST_CATEGORY_LABELS,
  type TestCategory,
} from "@/lib/care-loop/catalogue";
import { unwrap } from "@/lib/care-loop/result";
import { toast } from "@/lib/toast";
import { UrgencyBadge } from "./case-badges";
import { PatientPicker, type PickedPatient } from "./patient-picker";

const CATEGORY_ORDER: TestCategory[] = ["routine", "fever", "older_adult", "cancer", "infection"];

export function ResultEntryForm({ initialPatient }: { initialPatient: PickedPatient | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [patient, setPatient] = useState<PickedPatient | null>(initialPatient);
  const [unmatched, setUnmatched] = useState(false);
  const [unmatchedName, setUnmatchedName] = useState("");
  const [unmatchedIdentifier, setUnmatchedIdentifier] = useState("");
  const [testCode, setTestCode] = useState(TEST_CATALOGUE[0].code);
  const [numeric, setNumeric] = useState("");
  const [text, setText] = useState("");
  const [collectedOn, setCollectedOn] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const test = TEST_CATALOGUE.find((item) => item.code === testCode)!;
  const suggested = useMemo(
    () =>
      suggestUrgency(testCode, {
        numeric: numeric.trim() === "" ? null : Number(numeric),
        text: text || null,
      }),
    [testCode, numeric, text]
  );

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await enterResult({
          patientId: unmatched ? null : patient?.id ?? null,
          unmatchedName: unmatched ? unmatchedName : null,
          unmatchedIdentifier: unmatched ? unmatchedIdentifier : null,
          testCode,
          valueNumeric: test.kind === "numeric" && numeric.trim() !== "" ? Number(numeric) : null,
          valueText: test.kind === "numeric" ? null : text,
          collectedOn: collectedOn || null,
          source,
          notes,
        }));
        toast.success("Result logged", suggested ? "Flagged for doctor triage." : "Waiting for doctor review.");
        router.push("/cases?list=triage");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unable to save this result.";
        setError(message);
        toast.error("Result not saved", message);
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Log a result</CardTitle>
        <CardDescription>
          Enter the result as printed on the lab or imaging report. A doctor confirms every flag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="result-patient">Patient</Label>
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() => setUnmatched((value) => !value)}
            >
              {unmatched ? "Search registered patients" : "Can't find the patient?"}
            </button>
          </div>
          {unmatched ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="result-patient"
                placeholder="Name on the report"
                value={unmatchedName}
                onChange={(event) => setUnmatchedName(event.target.value)}
              />
              <Input
                placeholder="IC or lab ID on the report"
                value={unmatchedIdentifier}
                onChange={(event) => setUnmatchedIdentifier(event.target.value)}
              />
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Unmatched results stay open in the triage list until someone matches them to a patient.
              </p>
            </div>
          ) : (
            <PatientPicker id="result-patient" value={patient} onChange={setPatient} />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="result-test">Test</Label>
            <select
              id="result-test"
              value={testCode}
              onChange={(event) => {
                setTestCode(event.target.value);
                setNumeric("");
                setText("");
              }}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {CATEGORY_ORDER.map((category) => (
                <optgroup key={category} label={TEST_CATEGORY_LABELS[category]}>
                  {TEST_CATALOGUE.filter((item) => item.category === category).map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="result-value">Result</Label>
            {test.kind === "choice" ? (
              <select
                id="result-value"
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Select…</option>
                {test.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : test.kind === "blood_pressure" ? (
              <Input
                id="result-value"
                placeholder="e.g. 150/95"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="result-value"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={numeric}
                  onChange={(event) => setNumeric(event.target.value)}
                />
                <span className="shrink-0 text-sm text-muted-foreground">{test.unit}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Default rule suggests:</span>
          {suggested ? <UrgencyBadge urgency={suggested} /> : <span>Within normal range</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="result-collected">Collected on</Label>
            <Input
              id="result-collected"
              type="date"
              value={collectedOn}
              onChange={(event) => setCollectedOn(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="result-source">Source</Label>
            <Input
              id="result-source"
              placeholder="Lab or imaging centre"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="result-notes">Notes</Label>
          <Textarea
            id="result-notes"
            rows={2}
            placeholder="Optional: comments printed on the report"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="button" disabled={isPending} onClick={submit}>
          Log result
        </Button>
      </CardContent>
    </Card>
  );
}
