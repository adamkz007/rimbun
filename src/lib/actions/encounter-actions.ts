"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireActionAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import type { DrugRoute, NoteSection } from "@/types/database";

export async function createEncounter(patientId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["doctor", "nurse"],
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
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  const { error } = await supabase
    .from("encounter_vitals")
    .upsert(
      { encounter_id: encounterId, recorded_by: staff.id, ...vitals },
      { onConflict: "encounter_id" }
    );

  if (error) throw new Error(error.message);
}

export async function saveNote(encounterId: string, section: NoteSection, content: Record<string, unknown>) {
  const supabase = await getSupabaseServerClient();
  await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  const { error } = await supabase
    .from("encounter_notes")
    .upsert(
      { encounter_id: encounterId, section, content },
      { onConflict: "encounter_id,section" }
    );

  if (error) throw new Error(error.message);
}

export async function addDiagnosis(encounterId: string, icd10Code: string, icd10Description: string, type: "primary" | "secondary" = "primary") {
  const supabase = await getSupabaseServerClient();
  await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  const { data, error } = await supabase
    .from("encounter_diagnoses")
    .insert({
      encounter_id: encounterId,
      icd10_code: icd10Code,
      icd10_description: icd10Description,
      diagnosis_type: type,
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removeDiagnosis(diagnosisId: string) {
  const supabase = await getSupabaseServerClient();
  await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });
  const { error } = await supabase.from("encounter_diagnoses").delete().eq("id", diagnosisId);
  if (error) throw new Error(error.message);
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
  const supabase = await getSupabaseServerClient();
  await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

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
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removePrescription(prescriptionId: string) {
  const supabase = await getSupabaseServerClient();
  await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });
  const { error } = await supabase.from("encounter_prescriptions").delete().eq("id", prescriptionId);
  if (error) throw new Error(error.message);
}

export async function saveScratchpad(encounterId: string, canvasData: Record<string, unknown>, label?: string) {
  const supabase = await getSupabaseServerClient();
  await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  const { error } = await supabase
    .from("encounter_scratchpads")
    .upsert(
      { encounter_id: encounterId, canvas_data: canvasData, label: label ?? null },
      { onConflict: "encounter_id" }
    );

  if (error) throw new Error(error.message);
}

export async function completeEncounter(encounterId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  const { error } = await supabase
    .from("encounters")
    .update({ status: "completed" })
    .eq("id", encounterId);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "encounter.completed",
    targetType: "encounter",
    targetId: encounterId,
    details: {
      status: "completed",
    },
  });
}
