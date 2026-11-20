"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Check } from "lucide-react";
import { VitalsForm } from "./vitals-form";
import { NotesEditor } from "./notes-editor";
import { EncounterHistory } from "./encounter-history";
import { DiagnosisPicker } from "./diagnosis-picker";
import { PrescriptionForm } from "./prescription-form";
import { ScratchpadCanvas } from "./scratchpad-canvas";
import { SafetyNetPanel, type SafetyNetPanelData } from "@/components/safety-net/safety-net-panel";
import {
  completeEncounter,
  saveNote,
  saveScratchpad,
  saveVitals,
  startEncounterAmendment,
} from "@/lib/actions/encounter-actions";
import { NOTE_SECTIONS, VITAL_FIELDS } from "@/lib/constants";
import {
  getClerkingTabFromShortcut,
  shouldIgnoreClerkingShortcut,
  type ClerkingTab,
} from "@/lib/clerking-shortcuts";
import { toast } from "@/lib/toast";
import type { NoteSection, StaffRole, Tables } from "@/types/database";
import { differenceInYears, format } from "date-fns";

type EncounterStaffRelation = { full_name: string } | null;
type EncounterPatient = Pick<
  Tables<"patients">,
  "id" | "full_name" | "mrn" | "date_of_birth" | "gender" | "allergies" | "phone"
>;
type EncounterWithRelations = Tables<"encounters"> & {
  patients: EncounterPatient;
  encounter_vitals: Tables<"encounter_vitals">[] | Tables<"encounter_vitals"> | null;
  encounter_notes: Tables<"encounter_notes">[];
  encounter_diagnoses: Tables<"encounter_diagnoses">[];
  encounter_prescriptions: Tables<"encounter_prescriptions">[];
  encounter_scratchpads: Tables<"encounter_scratchpads">[] | Tables<"encounter_scratchpads"> | null;
  completed_by_staff: EncounterStaffRelation[] | EncounterStaffRelation;
  amendment_started_by_staff: EncounterStaffRelation[] | EncounterStaffRelation;
  last_amended_by_staff: EncounterStaffRelation[] | EncounterStaffRelation;
};
type EncounterHistoryItems = ComponentProps<typeof EncounterHistory>["encounters"];
type CurrentStaff = {
  id: string;
  fullName: string;
  role: StaffRole;
};

const WORKSPACE_TABS: { value: ClerkingTab; label: string }[] = [
  ...NOTE_SECTIONS.slice(0, 4),
  { value: "prescription", label: "Prescription" },
  ...NOTE_SECTIONS.slice(4),
];
const NOTE_DRAFT_SECTIONS = NOTE_SECTIONS.map((section) => section.value);
type VitalsFieldKey = (typeof VITAL_FIELDS)[number]["key"];
type VitalsFormData = Partial<Record<VitalsFieldKey, number | null>>;

export function ClerkingWorkspace({
  encounter,
  historyEncounters,
  currentStaff,
  safetyNet,
}: {
  encounter: EncounterWithRelations;
  historyEncounters: EncounterHistoryItems;
  currentStaff: CurrentStaff;
  /** Present when Care Loop is on: the safety-net follow-up panel. */
  safetyNet?: SafetyNetPanelData | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClerkingTab>("chief_complaint");
  const [completing, setCompleting] = useState(false);
  const [startingAmendment, setStartingAmendment] = useState(false);
  const patient = encounter.patients;
  const encounterVitals = getSingleRelation(encounter.encounter_vitals);
  const encounterScratchpad = getSingleRelation(encounter.encounter_scratchpads);
  const initialVitals = normalizeVitalsForForm(encounterVitals);
  const isDoctor = currentStaff.role === "doctor";
  const amendmentInProgress = Boolean(encounter.amendment_started_at);
  const canEditEncounter = isDoctor && (encounter.status === "in_progress" || amendmentInProgress);
  const canStartAmendment =
    isDoctor &&
    !amendmentInProgress &&
    (encounter.status === "completed" || encounter.status === "amended");
  const isReadOnly = !canEditEncounter;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      if (shouldIgnoreClerkingShortcut(event.target)) {
        return;
      }

      const digit = Number(event.key);
      const nextTab = getClerkingTabFromShortcut(digit);
      if (!nextTab) {
        return;
      }

      event.preventDefault();
      setActiveTab(nextTab);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const age = patient.date_of_birth
    ? differenceInYears(new Date(), new Date(patient.date_of_birth))
    : null;

  async function handleComplete() {
    const confirmationMessage = amendmentInProgress
      ? "Finalize this amendment? The record will be locked again."
      : "Complete this encounter? The record will be locked.";
    if (!confirm(confirmationMessage)) return;
    setCompleting(true);
    try {
      await persistEncounterDrafts(encounter.id);
      await completeEncounter(encounter.id);
      if (amendmentInProgress) {
        toast.success("Amendment finalized", "The encounter record is locked again.");
        router.refresh();
        return;
      }
      toast.success("Encounter completed", "The record has been locked.");
      router.push("/clerking");
    } catch (error) {
      setCompleting(false);
      toast.error(
        "Unable to complete encounter",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  }

  async function handleStartAmendment() {
    if (!confirm("Reopen this encounter for amendment? Only doctors can edit amended records.")) {
      return;
    }

    setStartingAmendment(true);
    try {
      await startEncounterAmendment(encounter.id);
      toast.success("Amendment started", "You can edit this encounter again.");
      router.refresh();
    } catch (error) {
      setStartingAmendment(false);
      toast.error(
        "Unable to start amendment",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)] gap-4">
      {/* Left Panel - Notes Editor */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full justify-start" aria-label="Clerking sections">
            {WORKSPACE_TABS.map((tab, index) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs"
                aria-keyshortcuts={`Alt+${index + 1}`}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {WORKSPACE_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="flex-1 overflow-auto mt-4">
              {tab.value === "history" ? (
                <EncounterHistory encounters={historyEncounters} />
              ) : tab.value === "diagnosis" ? (
                <div className="space-y-4">
                  <DiagnosisPicker
                    encounterId={encounter.id}
                    initialDiagnoses={encounter.encounter_diagnoses ?? []}
                    disabled={isReadOnly}
                  />
                  <Separator />
                  <NotesEditor
                    encounterId={encounter.id}
                    section={tab.value}
                    initialContent={findNoteContent(encounter.encounter_notes, tab.value)}
                    disabled={isReadOnly}
                  />
                </div>
              ) : tab.value === "prescription" ? (
                <PrescriptionForm
                  encounterId={encounter.id}
                  initialPrescriptions={encounter.encounter_prescriptions ?? []}
                  disabled={isReadOnly}
                />
              ) : (
                <NotesEditor
                  encounterId={encounter.id}
                  section={tab.value}
                  initialContent={findNoteContent(encounter.encounter_notes, tab.value)}
                  disabled={isReadOnly}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Right Panel - Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4 overflow-auto">
        {/* Patient Summary */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm">{patient.full_name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  MRN: {patient.mrn} | {patient.gender}
                  {age !== null ? ` | ${age}y` : ""}
                </p>
              </div>
              <Badge
                variant={encounter.status === "in_progress" ? "default" : "secondary"}
                aria-label={`Encounter status: ${formatEncounterStatus(encounter.status)}`}
              >
                {formatEncounterStatus(encounter.status)}
              </Badge>
            </div>
          </CardHeader>
          {patient.allergies?.length > 0 && (
            <CardContent className="pt-0 pb-3">
              <div className="flex items-center gap-1 flex-wrap">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                {patient.allergies.map((a: string) => (
                  <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Encounter Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
            <p>Status: <span className="font-medium text-foreground">{formatEncounterStatus(encounter.status)}</span></p>
            {encounter.completed_at ? (
              <p>
                Completed {formatEncounterTimestamp(encounter.completed_at)}
                {getStaffName(encounter.completed_by_staff)
                  ? ` by ${getStaffName(encounter.completed_by_staff)}`
                  : ""}
              </p>
            ) : null}
            {encounter.last_amended_at ? (
              <p>
                Last amended {formatEncounterTimestamp(encounter.last_amended_at)}
                {getStaffName(encounter.last_amended_by_staff)
                  ? ` by ${getStaffName(encounter.last_amended_by_staff)}`
                  : ""}
              </p>
            ) : null}
            {amendmentInProgress ? (
              <p>
                Amendment in progress since {formatEncounterTimestamp(encounter.amendment_started_at)}
                {getStaffName(encounter.amendment_started_by_staff)
                  ? ` by ${getStaffName(encounter.amendment_started_by_staff)}`
                  : ""}
              </p>
            ) : null}
            {!isDoctor ? (
              <p className="rounded-md border bg-muted/40 px-2 py-1.5">
                Nurses can view clerking records, but only doctors can edit or complete them.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Vitals */}
        <VitalsForm
          encounterId={encounter.id}
          initialVitals={initialVitals}
          disabled={isReadOnly}
        />

        {safetyNet ? (
          <SafetyNetPanel
            encounterId={encounter.id}
            data={safetyNet}
            isDoctor={isDoctor}
            beforeSuggest={canEditEncounter ? () => persistEncounterDrafts(encounter.id) : undefined}
          />
        ) : null}

        {/* Complete Button */}
        {canEditEncounter && (
          <Button onClick={handleComplete} disabled={completing} className="w-full">
            <Check className="mr-2 h-4 w-4" />
            {completing
              ? amendmentInProgress
                ? "Finalizing..."
                : "Completing..."
              : amendmentInProgress
                ? "Finalize Amendment"
                : "Complete Encounter"}
          </Button>
        )}
        {canStartAmendment && (
          <Button
            onClick={handleStartAmendment}
            disabled={startingAmendment}
            variant="outline"
            className="w-full"
          >
            {startingAmendment ? "Opening Amendment..." : "Amend Encounter"}
          </Button>
        )}
        {!canEditEncounter && (
          <Badge
            variant="secondary"
            className="w-full justify-center py-2"
            role="status"
            aria-live="polite"
          >
            {canStartAmendment ? "Encounter Locked" : "Read Only"}
          </Badge>
        )}
      </div>

      <ScratchpadCanvas
        encounterId={encounter.id}
        initialData={encounterScratchpad?.canvas_data ?? null}
        disabled={isReadOnly}
      />
    </div>
  );
}

function findNoteContent(
  notes: Tables<"encounter_notes">[],
  section: NoteSection
): Record<string, unknown> | null {
  const note = notes.find((item) => item.section === section);
  return note?.content ?? null;
}

function getSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function formatEncounterStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEncounterTimestamp(value: string | null | undefined) {
  if (!value) return "";
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}

function getStaffName(
  relation: { full_name?: string } | { full_name?: string }[] | Array<{ full_name?: string } | null> | null | undefined
) {
  if (!relation) return null;
  return Array.isArray(relation)
    ? relation.find((item) => item?.full_name)?.full_name ?? null
    : relation.full_name ?? null;
}

function normalizeVitalsForForm(
  vitals: Tables<"encounter_vitals"> | null
): VitalsFormData | null {
  if (!vitals) return null;

  return Object.fromEntries(
    VITAL_FIELDS.map((field) => [field.key, vitals[field.key] ?? null])
  ) as VitalsFormData;
}

function parseStoredDraft<T>(storedDraft: string | null): T | null {
  if (storedDraft === null) return null;

  try {
    return JSON.parse(storedDraft) as T;
  } catch {
    return null;
  }
}

async function persistEncounterDrafts(encounterId: string) {
  const pendingSaves: Promise<void>[] = [];

  for (const section of NOTE_DRAFT_SECTIONS) {
    const storageKey = `clerking:draft:note:${encounterId}:${section}`;
    const draft = parseStoredDraft<Record<string, unknown>>(window.sessionStorage.getItem(storageKey));
    if (!draft) {
      window.sessionStorage.removeItem(storageKey);
      continue;
    }

    pendingSaves.push(
      saveNote(encounterId, section, draft).then(() => {
        window.sessionStorage.removeItem(storageKey);
      })
    );
  }

  const vitalsStorageKey = `clerking:draft:vitals:${encounterId}`;
  const vitalsDraft = parseStoredDraft<Record<string, number | null>>(window.sessionStorage.getItem(vitalsStorageKey));
  if (vitalsDraft) {
    pendingSaves.push(
      saveVitals(encounterId, vitalsDraft).then(() => {
        window.sessionStorage.removeItem(vitalsStorageKey);
      })
    );
  } else {
    window.sessionStorage.removeItem(vitalsStorageKey);
  }

  const scratchpadStorageKey = `clerking:draft:scratchpad:${encounterId}`;
  const scratchpadDraft = parseStoredDraft<Record<string, unknown>>(window.sessionStorage.getItem(scratchpadStorageKey));
  if (scratchpadDraft) {
    pendingSaves.push(
      saveScratchpad(encounterId, scratchpadDraft).then(() => {
        window.sessionStorage.removeItem(scratchpadStorageKey);
      })
    );
  } else {
    window.sessionStorage.removeItem(scratchpadStorageKey);
  }

  await Promise.all(pendingSaves);
}
