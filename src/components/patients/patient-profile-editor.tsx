"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientFormFields } from "@/components/patients/patient-form-fields";
import {
  archivePatient,
  mergePatients,
  restorePatient,
  updatePatient,
} from "@/lib/actions/patient-actions";
import { toast } from "@/lib/toast";
import {
  patientToFormValues,
  type PatientDuplicateMatch,
  type PatientFieldErrors,
} from "@/lib/patients";
import type { Tables } from "@/types/database";

type PatientProfileEditorProps = {
  patient: Pick<
    Tables<"patients">,
    | "id"
    | "full_name"
    | "ic_number"
    | "date_of_birth"
    | "gender"
    | "phone"
    | "email"
    | "address"
    | "emergency_contact_name"
    | "emergency_contact_phone"
    | "allergies"
    | "medical_history"
    | "archived_at"
    | "archived_reason"
    | "merged_into_patient_id"
  >;
  mergeCandidates: Array<{
    id: string;
    full_name: string;
    mrn: string;
  }>;
};

export function PatientProfileEditor({
  patient,
  mergeCandidates,
}: PatientProfileEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState(() => patientToFormValues(patient));
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [duplicateMatches, setDuplicateMatches] = useState<PatientDuplicateMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isMergedSource = Boolean(patient.merged_into_patient_id);
  const isArchived = Boolean(patient.archived_at);

  function handleChange<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSave() {
    setMessage(null);
    setDuplicateMatches([]);

    startTransition(async () => {
      const result = await updatePatient(patient.id, form);
      setMessage(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      setDuplicateMatches(result.duplicateMatches ?? []);

      if (result.success) {
        toast.success("Patient updated", result.message);
        router.refresh();
      } else if (result.message) {
        toast.error("Update failed", result.message);
      }
    });
  }

  function handleArchive() {
    setArchiveMessage(null);

    startTransition(async () => {
      const result = await archivePatient({
        patientId: patient.id,
        reason: archiveReason,
      });
      setArchiveMessage(result.message);

      if (result.success) {
        setArchiveOpen(false);
        toast.success("Patient archived", result.message);
        router.refresh();
      } else if (result.message) {
        toast.error("Archive failed", result.message);
      }
    });
  }

  function handleRestore() {
    setArchiveMessage(null);

    startTransition(async () => {
      const result = await restorePatient(patient.id);
      setArchiveMessage(result.message);

      if (result.success) {
        toast.success("Patient restored", result.message);
        router.refresh();
      } else if (result.message) {
        toast.error("Restore failed", result.message);
      }
    });
  }

  function handleMerge() {
    setArchiveMessage(null);

    startTransition(async () => {
      const result = await mergePatients({
        sourcePatientId: patient.id,
        targetPatientId: mergeTargetId,
        reason: mergeReason,
      });
      setArchiveMessage(result.message);

      if (result.success) {
        setMergeOpen(false);
        toast.success("Patients merged", result.message);
        if (result.redirectPatientId) {
          router.push(`/patients/${result.redirectPatientId}`);
          return;
        }
        router.refresh();
      } else if (result.message) {
        toast.error("Merge failed", result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle>Manage Patient Record</CardTitle>
          <CardDescription>
            Update demographics, contact details, emergency information, and clinical history.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {isArchived && !isMergedSource ? (
            <Button variant="secondary" onClick={handleRestore} disabled={isPending}>
              Restore Record
            </Button>
          ) : null}
          {!isArchived ? (
            <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
              <DialogTrigger render={<Button variant="destructive" />} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive Patient Record</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="archive-reason">Reason</Label>
                    <Input
                      id="archive-reason"
                      value={archiveReason}
                      onChange={(event) => setArchiveReason(event.target.value)}
                      placeholder="Duplicate, requested removal, inactive record..."
                    />
                  </div>
                  <Button className="w-full" variant="destructive" onClick={handleArchive}>
                    Confirm Archive
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
          {!isArchived && mergeCandidates.length ? (
            <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
              <DialogTrigger render={<Button variant="outline" />} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Merge Patient Record</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="merge-target">Target Patient</Label>
                    <select
                      id="merge-target"
                      value={mergeTargetId}
                      onChange={(event) => setMergeTargetId(event.target.value)}
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    >
                      <option value="">Choose a target record</option>
                      {mergeCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.full_name} ({candidate.mrn})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="merge-reason">Reason</Label>
                    <Input
                      id="merge-reason"
                      value={mergeReason}
                      onChange={(event) => setMergeReason(event.target.value)}
                      placeholder="Explain why these records should be merged"
                    />
                  </div>
                  <Button className="w-full" onClick={handleMerge}>
                    Confirm Merge
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isMergedSource ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            This record has already been merged into another patient and is now read-only.
          </div>
        ) : null}

        {isArchived && patient.archived_reason ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            Archived reason: {patient.archived_reason}
          </div>
        ) : null}

        {message ? <div className="rounded-lg border bg-muted/40 p-3 text-sm">{message}</div> : null}
        {archiveMessage ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">{archiveMessage}</div>
        ) : null}

        {duplicateMatches.length ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="font-medium">Possible duplicates</p>
            <div className="mt-2 space-y-2">
              {duplicateMatches.map((match) => (
                <div key={match.id} className="rounded-md border bg-background p-2">
                  <p className="font-medium">{match.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {match.mrn} • {match.reasons.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <PatientFormFields
          values={form}
          errors={fieldErrors}
          onChange={handleChange}
          idPrefix="patient-profile"
          disabled={isPending || isArchived || isMergedSource}
        />

        <Button
          onClick={handleSave}
          disabled={isPending || isArchived || isMergedSource}
          className="w-full md:w-auto"
        >
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
