"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Check, AlertTriangle } from "lucide-react";
import { VitalsForm } from "./vitals-form";
import { NotesEditor } from "./notes-editor";
import { EncounterHistory } from "./encounter-history";
import { DiagnosisPicker } from "./diagnosis-picker";
import { PrescriptionForm } from "./prescription-form";
import { ScratchpadCanvas } from "./scratchpad-canvas";
import {
  completeEncounter,
  saveNote,
  saveScratchpad,
  saveVitals,
} from "@/lib/actions/encounter-actions";
import { NOTE_SECTIONS } from "@/lib/constants";
import type { NoteSection } from "@/types/database";
import { differenceInYears } from "date-fns";

type EncounterWithRelations = any;
type ClerkingTab = NoteSection | "prescription";

const WORKSPACE_TABS: { value: ClerkingTab; label: string }[] = [
  ...NOTE_SECTIONS.slice(0, 4),
  { value: "prescription", label: "Prescription" },
  ...NOTE_SECTIONS.slice(4),
];
const NOTE_DRAFT_SECTIONS = NOTE_SECTIONS.map((section) => section.value);

export function ClerkingWorkspace({
  encounter,
  historyEncounters,
}: {
  encounter: EncounterWithRelations;
  historyEncounters: any[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("chief_complaint");
  const [completing, setCompleting] = useState(false);
  const patient = encounter.patients;
  const isCompleted = encounter.status === "completed";
  const encounterVitals = getSingleRelation(encounter.encounter_vitals);
  const encounterScratchpad = getSingleRelation(encounter.encounter_scratchpads);

  const age = patient.date_of_birth
    ? differenceInYears(new Date(), new Date(patient.date_of_birth))
    : null;

  async function handleComplete() {
    if (!confirm("Complete this encounter? The record will be locked.")) return;
    setCompleting(true);
    try {
      await persistEncounterDrafts(encounter.id);
      await completeEncounter(encounter.id);
      router.push("/clerking");
    } catch (error) {
      setCompleting(false);
      alert(error instanceof Error ? error.message : "Unable to complete encounter.");
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)] gap-4">
      {/* Left Panel - Notes Editor */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full justify-start">
            {WORKSPACE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
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
                    disabled={isCompleted}
                  />
                  <Separator />
                  <NotesEditor
                    encounterId={encounter.id}
                    section={tab.value}
                    initialContent={findNoteContent(encounter.encounter_notes, tab.value)}
                    disabled={isCompleted}
                  />
                </div>
              ) : tab.value === "prescription" ? (
                <PrescriptionForm
                  encounterId={encounter.id}
                  initialPrescriptions={encounter.encounter_prescriptions ?? []}
                  disabled={isCompleted}
                />
              ) : (
                <NotesEditor
                  encounterId={encounter.id}
                  section={tab.value}
                  initialContent={findNoteContent(encounter.encounter_notes, tab.value)}
                  disabled={isCompleted}
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
            <CardTitle className="text-sm">{patient.full_name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              MRN: {patient.mrn} | {patient.gender}{age !== null ? ` | ${age}y` : ""}
            </p>
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

        {/* Vitals */}
        <VitalsForm
          encounterId={encounter.id}
          initialVitals={encounterVitals}
          disabled={isCompleted}
        />

        {/* Scratchpad */}
        <ScratchpadCanvas
          encounterId={encounter.id}
          initialData={encounterScratchpad?.canvas_data ?? null}
          disabled={isCompleted}
        />

        {/* Complete Button */}
        {!isCompleted && (
          <Button onClick={handleComplete} disabled={completing} className="w-full">
            <Check className="mr-2 h-4 w-4" />
            {completing ? "Completing..." : "Complete Encounter"}
          </Button>
        )}
        {isCompleted && (
          <Badge variant="secondary" className="w-full justify-center py-2">
            Encounter Completed
          </Badge>
        )}
      </div>
    </div>
  );
}

function findNoteContent(notes: any[], section: NoteSection): Record<string, unknown> | null {
  const note = notes?.find((n: any) => n.section === section);
  return note?.content ?? null;
}

function getSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
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
