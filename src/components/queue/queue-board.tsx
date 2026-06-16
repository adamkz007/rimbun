"use client";

import { useDeferredValue, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ClipboardPen,
  Monitor,
  Stethoscope,
  UserCheck,
  UserMinus,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  checkInPatient,
  reorderQueueEntry,
  startEncounterFromQueue,
  updateQueueStatus,
} from "@/lib/actions/queue-actions";
import {
  canCancelQueueEntry,
  canCheckInPatients,
  canManageQueueOrder,
  canStartEncounterFromQueue,
  canUpdateQueueStatus,
  formatQueueNumber,
  formatWaitDuration,
  getQueueStatusLabel,
  isActiveQueueStatus,
  QUEUE_ARRIVAL_LABELS,
  sortQueueEntries,
} from "@/lib/queue";
import { toast } from "@/lib/toast";
import type { QueueArrivalType, QueueStatus, StaffRole } from "@/types/database";

type PatientSummary = {
  id: string;
  full_name: string;
  mrn: string;
};

type DoctorSummary = {
  id: string;
  full_name: string;
};

export type QueueBoardEntry = {
  id: string;
  queue_number: number;
  status: QueueStatus;
  arrival_type: QueueArrivalType;
  sort_order: number;
  checked_in_at: string;
  status_updated_at: string;
  notes: string | null;
  encounter_id: string | null;
  assigned_doctor_id: string | null;
  patients: PatientSummary | PatientSummary[] | null;
  assigned_doctor: DoctorSummary | DoctorSummary[] | null;
};

type QueueBoardProps = {
  entries: QueueBoardEntry[];
  doctors: DoctorSummary[];
  staffRole: StaffRole;
  staffId: string;
};

type PatientSearchResult = {
  id: string;
  full_name: string;
  mrn: string;
};

export function QueueBoard({ entries, doctors, staffRole, staffId }: QueueBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const deferredPatientQuery = useDeferredValue(patientQuery);
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [arrivalType, setArrivalType] = useState<QueueArrivalType>("walk_in");
  const [assignedDoctorId, setAssignedDoctorId] = useState("");
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const activeEntries = sortQueueEntries(
    entries.filter((entry) => isActiveQueueStatus(entry.status))
  );
  const inactiveEntries = entries.filter((entry) => !isActiveQueueStatus(entry.status));

  async function searchPatients(query: string) {
    setPatientQuery(query);
    setSelectedPatient(null);

    if (query.trim().length < 2) {
      setPatientResults([]);
      return;
    }

    const response = await fetch(`/api/search/patients?q=${encodeURIComponent(query)}&limit=8`);
    const data = (await response.json()) as PatientSearchResult[];
    setPatientResults(data);
  }

  async function handleCheckIn() {
    if (!selectedPatient) {
      setCheckInError("Select a patient to check in.");
      return;
    }

    setCheckInError(null);

    startTransition(async () => {
      try {
        const entry = await checkInPatient({
          patientId: selectedPatient.id,
          arrivalType,
          assignedDoctorId: assignedDoctorId || null,
          notes: checkInNotes,
        });

        toast.success(
          "Patient checked in",
          `${selectedPatient.full_name} is queue ${formatQueueNumber(entry.queue_number)}.`
        );
        setCheckInOpen(false);
        setPatientQuery("");
        setPatientResults([]);
        setSelectedPatient(null);
        setAssignedDoctorId("");
        setCheckInNotes("");
        setArrivalType("walk_in");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to check in this patient.";
        setCheckInError(message);
        toast.error("Check-in failed", message);
      }
    });
  }

  async function runEntryAction(
    entryId: string,
    action: () => Promise<void>,
    successTitle: string,
    successDescription?: string
  ) {
    setBusyEntryId(entryId);

    try {
      await action();
      toast.success(successTitle, successDescription);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the queue.";
      toast.error("Queue update failed", message);
    } finally {
      setBusyEntryId(null);
    }
  }

  function getPatient(entry: QueueBoardEntry) {
    return Array.isArray(entry.patients) ? entry.patients[0] : entry.patients;
  }

  function getDoctor(entry: QueueBoardEntry) {
    return Array.isArray(entry.assigned_doctor)
      ? entry.assigned_doctor[0]
      : entry.assigned_doctor;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Queue</h1>
          <p className="text-sm text-muted-foreground">
            Check in arrivals, track waiting times, and hand patients off to clerking.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/queue/display">
            <Button variant="outline">
              <Monitor className="mr-2 h-4 w-4" />
              Waiting room display
            </Button>
          </Link>

          {canCheckInPatients(staffRole) ? (
            <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
              <DialogTrigger
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Check in patient
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Check in patient</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="queue-patient-search">Patient</Label>
                    <Input
                      id="queue-patient-search"
                      placeholder="Search by name, MRN, or IC..."
                      value={patientQuery}
                      onChange={(event) => {
                        void searchPatients(event.target.value);
                      }}
                      autoComplete="off"
                    />
                    {selectedPatient ? (
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        <p className="font-medium">{selectedPatient.full_name}</p>
                        <p className="text-muted-foreground">MRN {selectedPatient.mrn}</p>
                      </div>
                    ) : patientResults.length > 0 ? (
                      <div
                        className="max-h-48 overflow-y-auto rounded-md border"
                        role="listbox"
                        aria-label="Patient search results"
                      >
                        {patientResults.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                            onClick={() => {
                              setSelectedPatient(patient);
                              setPatientQuery(patient.full_name);
                              setPatientResults([]);
                            }}
                          >
                            <span className="font-medium">{patient.full_name}</span>
                            <span className="text-xs text-muted-foreground">MRN {patient.mrn}</span>
                          </button>
                        ))}
                      </div>
                    ) : deferredPatientQuery.trim().length >= 2 ? (
                      <p className="text-sm text-muted-foreground">No matching patients found.</p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="queue-arrival-type">Arrival type</Label>
                      <select
                        id="queue-arrival-type"
                        value={arrivalType}
                        onChange={(event) =>
                          setArrivalType(event.target.value as QueueArrivalType)
                        }
                        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      >
                        <option value="walk_in">{QUEUE_ARRIVAL_LABELS.walk_in}</option>
                        <option value="appointment">{QUEUE_ARRIVAL_LABELS.appointment}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="queue-assigned-doctor">Assigned doctor</Label>
                      <select
                        id="queue-assigned-doctor"
                        value={assignedDoctorId}
                        onChange={(event) => setAssignedDoctorId(event.target.value)}
                        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      >
                        <option value="">Any available doctor</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="queue-check-in-notes">Notes</Label>
                    <Textarea
                      id="queue-check-in-notes"
                      placeholder="Optional reception notes..."
                      value={checkInNotes}
                      onChange={(event) => setCheckInNotes(event.target.value)}
                      rows={3}
                    />
                  </div>

                  {checkInError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {checkInError}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    disabled={isPending || !selectedPatient}
                    onClick={() => {
                      void handleCheckIn();
                    }}
                  >
                    Check in
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {activeEntries.filter((entry) => entry.status === "waiting").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With nurse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {activeEntries.filter((entry) => entry.status === "with_nurse").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With doctor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {activeEntries.filter((entry) => entry.status === "with_doctor").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Active queue</CardTitle>
          <Badge variant="outline">{activeEntries.length} patient{activeEntries.length === 1 ? "" : "s"}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No patients in the queue right now.
            </p>
          ) : (
            activeEntries.map((entry, index) => {
              const patient = getPatient(entry);
              const doctor = getDoctor(entry);
              const isBusy = busyEntryId === entry.id || isPending;

              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-xl border px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {formatQueueNumber(entry.queue_number)}
                      </span>
                      <p className="truncate font-medium">
                        {patient?.full_name ?? "Unknown patient"}
                      </p>
                      <Badge variant="outline">{getQueueStatusLabel(entry.status)}</Badge>
                      <Badge variant="secondary">{QUEUE_ARRIVAL_LABELS[entry.arrival_type]}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>MRN {patient?.mrn ?? "N/A"}</span>
                      <span>Waiting {formatWaitDuration(entry.checked_in_at)}</span>
                      {doctor ? <span>Assigned to {doctor.full_name}</span> : null}
                    </div>
                    {entry.notes ? (
                      <p className="text-xs text-muted-foreground">{entry.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canManageQueueOrder(staffRole) ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy || index === 0}
                          aria-label={`Move ${formatQueueNumber(entry.queue_number)} up`}
                          onClick={() => {
                            void runEntryAction(
                              entry.id,
                              () => reorderQueueEntry(entry.id, "up"),
                              "Queue updated",
                              "Moved patient earlier in the queue."
                            );
                          }}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy || index === activeEntries.length - 1}
                          aria-label={`Move ${formatQueueNumber(entry.queue_number)} down`}
                          onClick={() => {
                            void runEntryAction(
                              entry.id,
                              () => reorderQueueEntry(entry.id, "down"),
                              "Queue updated",
                              "Moved patient later in the queue."
                            );
                          }}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}

                    {canUpdateQueueStatus(staffRole, entry.status, "with_nurse") ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => {
                          void runEntryAction(
                            entry.id,
                            () => updateQueueStatus(entry.id, "with_nurse"),
                            "Patient with nurse",
                            `${patient?.full_name ?? "Patient"} moved to nurse triage.`
                          );
                        }}
                      >
                        <Stethoscope className="mr-2 h-4 w-4" />
                        With nurse
                      </Button>
                    ) : null}

                    {canUpdateQueueStatus(staffRole, entry.status, "waiting") &&
                    entry.status !== "waiting" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => {
                          void runEntryAction(
                            entry.id,
                            () => updateQueueStatus(entry.id, "waiting"),
                            "Returned to waiting",
                            `${patient?.full_name ?? "Patient"} is back in the waiting queue.`
                          );
                        }}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Waiting
                      </Button>
                    ) : null}

                    {canStartEncounterFromQueue(staffRole) ? (
                      entry.encounter_id ? (
                        <Link href={`/clerking/${entry.encounter_id}`}>
                          <Button type="button" size="sm">
                            <ClipboardPen className="mr-2 h-4 w-4" />
                            Open encounter
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            isBusy ||
                            Boolean(
                              entry.assigned_doctor_id &&
                                entry.assigned_doctor_id !== staffId
                            )
                          }
                          onClick={() => {
                            void runEntryAction(
                              entry.id,
                              async () => {
                                const result = await startEncounterFromQueue(entry.id);
                                router.push(`/clerking/${result.encounterId}`);
                              },
                              "Encounter started",
                              "Opening the clerking workspace."
                            );
                          }}
                        >
                          <ClipboardPen className="mr-2 h-4 w-4" />
                          Start encounter
                        </Button>
                      )
                    ) : null}

                    {canCancelQueueEntry(staffRole) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => {
                          void runEntryAction(
                            entry.id,
                            () => updateQueueStatus(entry.id, "cancelled"),
                            "Queue entry cancelled"
                          );
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {inactiveEntries.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Completed and cancelled today</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowCompleted((value) => !value)}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              {showCompleted ? "Hide" : "Show"}
            </Button>
          </CardHeader>
          {showCompleted ? (
            <CardContent className="space-y-2">
              {inactiveEntries.map((entry) => {
                const patient = getPatient(entry);

                return (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">
                        {formatQueueNumber(entry.queue_number)}
                      </span>
                      <span>{patient?.full_name ?? "Unknown patient"}</span>
                      <Badge variant="outline">{getQueueStatusLabel(entry.status)}</Badge>
                    </div>
                    {entry.encounter_id ? (
                      <Link href={`/clerking/${entry.encounter_id}`} className="text-primary">
                        View encounter
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
