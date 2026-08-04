"use server";

import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import { generateDraftInvoiceFromEncounter } from "@/lib/actions/billing-actions";
import { createFulfillmentTasksFromEncounter } from "@/lib/actions/dispensary-actions";
import { completeQueueEntryForEncounter } from "@/lib/actions/queue-actions";
import { isModuleEnabled } from "@/lib/modules";
import { NOTE_SECTIONS } from "@/lib/constants";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  canEditEncounter,
  computeBmi,
  type EncounterAccessRecord,
  validateEncounterItemOrderIds,
} from "@/lib/encounters";
import type { DrugRoute, NoteSection } from "@/types/database";

type EncounterChildTable = "encounter_diagnoses" | "encounter_prescriptions";

const NOTE_SECTION_SORT_ORDER: Record<NoteSection, number> = Object.fromEntries(
  NOTE_SECTIONS.map((section, index) => [section.value, index])
) as Record<NoteSection, number>;

async function getEncounterAccessRecord(encounterId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  const { data: encounter, error } = await supabase
    .from("encounters")
    .select(
      "id, clinic_id, doctor_id, status, completed_at, completed_by, amendment_started_at, amendment_started_by, last_amended_at, last_amended_by"
    )
    .eq("id", encounterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!encounter || encounter.clinic_id !== staff.clinic_id) {
    throw new Error("Encounter not found.");
  }

  return {
    supabase,
    staff,
    encounter: encounter as EncounterAccessRecord,
  };
}

async function requireEncounterWriteAccess(encounterId: string) {
  const access = await getEncounterAccessRecord(encounterId);

  if (access.staff.role !== "doctor") {
    throw new Error("Only doctors can edit or complete encounters.");
  }

  if (!canEditEncounter(access.encounter)) {
    throw new Error("This encounter is locked. Start an amendment to continue editing.");
  }

  return access;
}

async function getEncounterIdForChildRecord(
  table: EncounterChildTable,
  recordId: string
) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from(table)
    .select("id, encounter_id")
    .eq("id", recordId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Encounter item not found.");

  return data.encounter_id;
}

async function normalizeDiagnosisOrder(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  encounterId: string
) {
  const { data, error } = await supabase
    .from("encounter_diagnoses")
    .select("id")
    .eq("encounter_id", encounterId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  await Promise.all(
    (data ?? []).map((diagnosis, index) =>
      supabase
        .from("encounter_diagnoses")
        .update({
          sort_order: index,
          diagnosis_type: index === 0 ? "primary" : "secondary",
        })
        .eq("id", diagnosis.id)
    )
  );
}

async function normalizePrescriptionOrder(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  encounterId: string
) {
  const { data, error } = await supabase
    .from("encounter_prescriptions")
    .select("id")
    .eq("encounter_id", encounterId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  await Promise.all(
    (data ?? []).map((prescription, index) =>
      supabase
        .from("encounter_prescriptions")
        .update({ sort_order: index })
        .eq("id", prescription.id)
    )
  );
}

async function validateEncounterItemOrder(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  table: EncounterChildTable,
  encounterId: string,
  orderedIds: string[]
) {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("encounter_id", encounterId);

  if (error) throw new Error(error.message);

  const existingIds = (data ?? []).map((item) => item.id);
  const validation = validateEncounterItemOrderIds(existingIds, orderedIds);

  if (!validation.valid) {
    throw new Error(validation.message);
  }
}

export async function createEncounter(patientId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["doctor"],
    module: "clerking",
  });
  const { data: patient } = await supabase
    .from("patients")
    .select("id, archived_at, merged_into_patient_id")
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) {
    throw new Error("Patient not found.");
  }

  if (patient.merged_into_patient_id) {
    throw new Error("This patient record has been merged into another record.");
  }

  if (patient.archived_at) {
    throw new Error("Archived patients cannot start new encounters.");
  }

  const { data, error } = await supabase
    .from("encounters")
    .insert({
      clinic_id: staff.clinic_id,
      patient_id: patientId,
      doctor_id: staff.id,
      status: "in_progress",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveVitals(encounterId: string, vitals: Record<string, number | null>) {
  const { supabase, staff } = await requireEncounterWriteAccess(encounterId);
  const bmi = computeBmi(vitals.weight, vitals.height);

  const { error } = await supabase
    .from("encounter_vitals")
    .upsert(
      { encounter_id: encounterId, recorded_by: staff.id, bmi, ...vitals },
      { onConflict: "encounter_id" }
    );

  if (error) throw new Error(error.message);
}

export async function saveNote(encounterId: string, section: NoteSection, content: Record<string, unknown>) {
  const { supabase } = await requireEncounterWriteAccess(encounterId);

  const { error } = await supabase
    .from("encounter_notes")
    .upsert(
      {
        encounter_id: encounterId,
        section,
        content,
        sort_order: NOTE_SECTION_SORT_ORDER[section] ?? 0,
      },
      { onConflict: "encounter_id,section" }
    );

  if (error) throw new Error(error.message);
}

export async function addDiagnosis(encounterId: string, icd10Code: string, icd10Description: string, type: "primary" | "secondary" = "primary") {
  const { supabase } = await requireEncounterWriteAccess(encounterId);
  const { data: existingDiagnoses, error: existingDiagnosesError } = await supabase
    .from("encounter_diagnoses")
    .select("id")
    .eq("encounter_id", encounterId)
    .order("sort_order", { ascending: true });

  if (existingDiagnosesError) throw new Error(existingDiagnosesError.message);

  const { data, error } = await supabase
    .from("encounter_diagnoses")
    .insert({
      encounter_id: encounterId,
      icd10_code: icd10Code,
      icd10_description: icd10Description,
      diagnosis_type: existingDiagnoses?.length ? type : "primary",
      sort_order: existingDiagnoses?.length ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removeDiagnosis(diagnosisId: string) {
  const encounterId = await getEncounterIdForChildRecord("encounter_diagnoses", diagnosisId);
  const { supabase } = await requireEncounterWriteAccess(encounterId);
  const { error } = await supabase.from("encounter_diagnoses").delete().eq("id", diagnosisId);
  if (error) throw new Error(error.message);

  await normalizeDiagnosisOrder(supabase, encounterId);
}

export async function reorderDiagnoses(encounterId: string, orderedIds: string[]) {
  const { supabase } = await requireEncounterWriteAccess(encounterId);

  await validateEncounterItemOrder(
    supabase,
    "encounter_diagnoses",
    encounterId,
    orderedIds
  );

  await Promise.all(
    orderedIds.map((diagnosisId, index) =>
      supabase
        .from("encounter_diagnoses")
        .update({
          sort_order: index,
          diagnosis_type: index === 0 ? "primary" : "secondary",
        })
        .eq("id", diagnosisId)
        .eq("encounter_id", encounterId)
    )
  );
}

export async function addPrescription(encounterId: string, prescription: {
  drug_id?: string | null;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  route?: DrugRoute;
  instructions?: string;
}) {
  const { supabase } = await requireEncounterWriteAccess(encounterId);
  const { data: existingPrescriptions, error: existingPrescriptionsError } = await supabase
    .from("encounter_prescriptions")
    .select("id")
    .eq("encounter_id", encounterId)
    .order("sort_order", { ascending: true });

  if (existingPrescriptionsError) throw new Error(existingPrescriptionsError.message);

  const { data, error } = await supabase
    .from("encounter_prescriptions")
    .insert({
      encounter_id: encounterId,
      drug_id: prescription.drug_id ?? null,
      drug_name: prescription.drug_name,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      quantity: prescription.quantity,
      route: prescription.route ?? "oral",
      instructions: prescription.instructions ?? null,
      is_dispensed: false,
      sort_order: existingPrescriptions?.length ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removePrescription(prescriptionId: string) {
  const encounterId = await getEncounterIdForChildRecord(
    "encounter_prescriptions",
    prescriptionId
  );
  const { supabase } = await requireEncounterWriteAccess(encounterId);
  const { error } = await supabase.from("encounter_prescriptions").delete().eq("id", prescriptionId);
  if (error) throw new Error(error.message);

  await normalizePrescriptionOrder(supabase, encounterId);
}

export async function reorderPrescriptions(encounterId: string, orderedIds: string[]) {
  const { supabase } = await requireEncounterWriteAccess(encounterId);

  await validateEncounterItemOrder(
    supabase,
    "encounter_prescriptions",
    encounterId,
    orderedIds
  );

  await Promise.all(
    orderedIds.map((prescriptionId, index) =>
      supabase
        .from("encounter_prescriptions")
        .update({ sort_order: index })
        .eq("id", prescriptionId)
        .eq("encounter_id", encounterId)
    )
  );
}

export async function saveScratchpad(encounterId: string, canvasData: Record<string, unknown>, label?: string) {
  const { supabase } = await requireEncounterWriteAccess(encounterId);

  const { error } = await supabase
    .from("encounter_scratchpads")
    .upsert(
      { encounter_id: encounterId, canvas_data: canvasData, label: label ?? null },
      { onConflict: "encounter_id" }
    );

  if (error) throw new Error(error.message);
}

export async function completeEncounter(encounterId: string) {
  const { supabase, staff, encounter } = await getEncounterAccessRecord(encounterId);

  if (staff.role !== "doctor") {
    throw new Error("Only doctors can edit or complete encounters.");
  }

  const isFinalizingAmendment = Boolean(encounter.amendment_started_at);
  const now = new Date().toISOString();
  const payload = isFinalizingAmendment
    ? {
        status: "amended" as const,
        amendment_started_at: null,
        amendment_started_by: null,
        last_amended_at: now,
        last_amended_by: staff.id,
      }
    : {
        status: "completed" as const,
        completed_at: encounter.completed_at ?? now,
        completed_by: encounter.completed_by ?? staff.id,
      };

  if (!isFinalizingAmendment && encounter.status !== "in_progress") {
    throw new Error("Only in-progress encounters can be completed.");
  }

  const { error } = await supabase
    .from("encounters")
    .update(payload)
    .eq("id", encounterId);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: isFinalizingAmendment ? "encounter.amended" : "encounter.completed",
    targetType: "encounter",
    targetId: encounterId,
    details: {
      status: payload.status,
    },
  });

  if (!isFinalizingAmendment) {
    await completeQueueEntryForEncounter(encounterId);

    if (isModuleEnabled(staff.clinics?.settings, "billing")) {
      await generateDraftInvoiceFromEncounter(encounterId, staff.clinics?.settings);
    }

    if (isModuleEnabled(staff.clinics?.settings, "dispensary")) {
      await createFulfillmentTasksFromEncounter(encounterId, staff.clinics?.settings);
    }
  }
}

export async function startEncounterAmendment(encounterId: string) {
  const { supabase, staff, encounter } = await getEncounterAccessRecord(encounterId);

  if (staff.role !== "doctor") {
    throw new Error("Only doctors can edit or complete encounters.");
  }

  if (encounter.status === "in_progress") {
    throw new Error("This encounter is already open for editing.");
  }

  if (encounter.amendment_started_at) {
    throw new Error("An amendment is already in progress for this encounter.");
  }

  const startedAt = new Date().toISOString();
  const { error } = await supabase
    .from("encounters")
    .update({
      amendment_started_at: startedAt,
      amendment_started_by: staff.id,
    })
    .eq("id", encounterId);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "encounter.amendment_started",
    targetType: "encounter",
    targetId: encounterId,
    details: {
      status: encounter.status,
      amendment_started_at: startedAt,
    },
  });
}
