"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import {
  type PatientActionResult,
  type PatientDuplicateMatch,
  type PatientFieldErrors,
  type PatientFormValues,
  parseMedicalHistory,
} from "@/lib/patients";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

const optionalString = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }, z.string().max(maxLength).optional());

const patientFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  icNumber: optionalString(30),
  dateOfBirth: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }, z.iso.date().optional()),
  gender: z.enum(["male", "female", "other"]).optional(),
  phone: optionalString(30),
  email: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().toLowerCase();
    return trimmed ? trimmed : undefined;
  }, z.email().optional()),
  address: optionalString(500),
  emergencyContactName: optionalString(120),
  emergencyContactPhone: optionalString(30),
  allergies: optionalString(1000),
  medicalConditions: optionalString(1000),
  currentMedications: optionalString(1000),
  surgicalHistory: optionalString(2000),
  familyHistory: optionalString(2000),
  socialHistory: optionalString(2000),
  medicalNotes: optionalString(2000),
});

const archivePatientSchema = z.object({
  patientId: z.uuid(),
  reason: z.string().trim().min(3, "Archive reason is required.").max(500),
});

const mergePatientsSchema = z.object({
  sourcePatientId: z.uuid(),
  targetPatientId: z.uuid(),
  reason: optionalString(500),
});

type ParsedPatientInput = z.output<typeof patientFormSchema>;
type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;
type PatientRecord = Pick<
  Tables<"patients">,
  | "id"
  | "full_name"
  | "mrn"
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

export async function registerPatient(input: PatientFormValues): Promise<PatientActionResult> {
  const staff = await requireActionAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
  });
  const parsed = patientFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid patient details.",
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await getSupabaseServerClient();
  const duplicates = await findDuplicatePatientMatches(supabase, parsed.data);
  if (duplicates.length) {
    return {
      success: false,
      message: "Possible duplicate patient records were found. Review the matches before registering.",
      duplicateMatches: duplicates,
    };
  }

  const mrn = await generateMRN(supabase, staff.clinic_id);

  const { data, error } = await supabase
    .from("patients")
    .insert({
      ...buildPatientPayload(staff.clinic_id, mrn, parsed.data),
      archived_at: null,
      archived_reason: null,
      merged_into_patient_id: null,
    })
    .select("id, full_name, mrn")
    .single();

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "patient.created",
    targetType: "patient",
    targetId: data.id,
    details: {
      fullName: data.full_name,
      mrn: data.mrn,
    },
  });

  revalidatePatientPaths(data.id);

  return {
    success: true,
    message: `Registered ${data.full_name}.`,
    patientId: data.id,
  };
}

export async function updatePatient(
  patientId: string,
  input: PatientFormValues
): Promise<PatientActionResult> {
  const staff = await requireActionAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
  });
  const parsedId = z.uuid().safeParse(patientId);
  const parsed = patientFormSchema.safeParse(input);

  if (!parsedId.success) {
    return {
      success: false,
      message: "Invalid patient record.",
    };
  }

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid patient details.",
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await getSupabaseServerClient();
  const existingPatient = await getPatientRecord(supabase, parsedId.data);

  if (!existingPatient) {
    return {
      success: false,
      message: "Patient not found.",
    };
  }

  if (existingPatient.merged_into_patient_id) {
    return {
      success: false,
      message: "This patient has already been merged into another record.",
    };
  }

  if (existingPatient.archived_at) {
    return {
      success: false,
      message: "Restore this patient before editing the record.",
    };
  }

  const duplicates = await findDuplicatePatientMatches(
    supabase,
    parsed.data,
    parsedId.data
  );

  if (duplicates.length) {
    return {
      success: false,
      message: "Possible duplicate patient records were found. Review the matches before saving.",
      duplicateMatches: duplicates,
    };
  }

  const { error } = await supabase
    .from("patients")
    .update(buildPatientPayload(staff.clinic_id, existingPatient.mrn, parsed.data))
    .eq("id", parsedId.data);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "patient.updated",
    targetType: "patient",
    targetId: parsedId.data,
    details: {
      previous: {
        fullName: existingPatient.full_name,
        phone: existingPatient.phone,
        email: existingPatient.email,
      },
      next: {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
      },
    },
  });

  revalidatePatientPaths(parsedId.data);

  return {
    success: true,
    message: "Patient record updated.",
    patientId: parsedId.data,
  };
}

export async function archivePatient(input: {
  patientId: string;
  reason: string;
}): Promise<PatientActionResult> {
  const actor = await requireActionAccess({
    roles: ["admin", "receptionist"],
  });
  const parsed = archivePatientSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid archive request.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const patient = await getPatientRecord(supabase, parsed.data.patientId);

  if (!patient) {
    return {
      success: false,
      message: "Patient not found.",
    };
  }

  if (patient.merged_into_patient_id) {
    return {
      success: false,
      message: "Merged patient records cannot be archived again.",
    };
  }

  if (patient.archived_at) {
    return {
      success: false,
      message: "This patient is already archived.",
    };
  }

  const { count } = await supabase
    .from("encounters")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", parsed.data.patientId)
    .eq("status", "in_progress");

  if ((count ?? 0) > 0) {
    return {
      success: false,
      message: "Finish or cancel in-progress encounters before archiving this patient.",
    };
  }

  const { error } = await supabase
    .from("patients")
    .update({
      archived_at: new Date().toISOString(),
      archived_reason: parsed.data.reason,
      merged_into_patient_id: null,
    })
    .eq("id", parsed.data.patientId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  await logAuditEvent({
    clinicId: actor.clinic_id,
    actorStaffId: actor.id,
    action: "patient.archived",
    targetType: "patient",
    targetId: parsed.data.patientId,
    details: {
      fullName: patient.full_name,
      mrn: patient.mrn,
      reason: parsed.data.reason,
    },
  });

  revalidatePatientPaths(parsed.data.patientId);

  return {
    success: true,
    message: `${patient.full_name} was archived.`,
    patientId: parsed.data.patientId,
  };
}

export async function restorePatient(patientId: string): Promise<PatientActionResult> {
  const actor = await requireActionAccess({
    roles: ["admin", "receptionist"],
  });
  const parsedId = z.uuid().safeParse(patientId);

  if (!parsedId.success) {
    return {
      success: false,
      message: "Invalid patient record.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const patient = await getPatientRecord(supabase, parsedId.data);

  if (!patient) {
    return {
      success: false,
      message: "Patient not found.",
    };
  }

  if (patient.merged_into_patient_id) {
    return {
      success: false,
      message: "Merged patient records cannot be restored.",
    };
  }

  if (!patient.archived_at) {
    return {
      success: false,
      message: "This patient is already active.",
    };
  }

  const { error } = await supabase
    .from("patients")
    .update({
      archived_at: null,
      archived_reason: null,
    })
    .eq("id", parsedId.data);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  await logAuditEvent({
    clinicId: actor.clinic_id,
    actorStaffId: actor.id,
    action: "patient.restored",
    targetType: "patient",
    targetId: parsedId.data,
    details: {
      fullName: patient.full_name,
      mrn: patient.mrn,
    },
  });

  revalidatePatientPaths(parsedId.data);

  return {
    success: true,
    message: `${patient.full_name} was restored.`,
    patientId: parsedId.data,
  };
}

export async function mergePatients(input: {
  sourcePatientId: string;
  targetPatientId: string;
  reason?: string;
}): Promise<PatientActionResult> {
  const actor = await requireActionAccess({
    roles: ["admin", "receptionist"],
  });
  const parsed = mergePatientsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid merge request.",
    };
  }

  if (parsed.data.sourcePatientId === parsed.data.targetPatientId) {
    return {
      success: false,
      message: "Choose a different patient record to merge into.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const [sourcePatient, targetPatient] = await Promise.all([
    getPatientRecord(supabase, parsed.data.sourcePatientId),
    getPatientRecord(supabase, parsed.data.targetPatientId),
  ]);

  if (!sourcePatient || !targetPatient) {
    return {
      success: false,
      message: "Unable to load both patient records for the merge.",
    };
  }

  if (sourcePatient.merged_into_patient_id) {
    return {
      success: false,
      message: "This patient has already been merged into another record.",
    };
  }

  if (targetPatient.archived_at) {
    return {
      success: false,
      message: "You can only merge into an active patient record.",
    };
  }

  const mergedPatientUpdate = buildMergedPatientUpdate(targetPatient, sourcePatient);
  const { error: updateTargetError } = await supabase
    .from("patients")
    .update(mergedPatientUpdate)
    .eq("id", targetPatient.id);

  if (updateTargetError) {
    return {
      success: false,
      message: updateTargetError.message,
    };
  }

  const { error: moveEncountersError } = await supabase
    .from("encounters")
    .update({ patient_id: targetPatient.id })
    .eq("patient_id", sourcePatient.id);

  if (moveEncountersError) {
    return {
      success: false,
      message: moveEncountersError.message,
    };
  }

  const mergeReason =
    parsed.data.reason ??
    `Merged duplicate patient ${sourcePatient.full_name} (${sourcePatient.mrn}) into ${targetPatient.full_name} (${targetPatient.mrn}).`;

  const { error: archiveSourceError } = await supabase
    .from("patients")
    .update({
      archived_at: new Date().toISOString(),
      archived_reason: mergeReason,
      merged_into_patient_id: targetPatient.id,
    })
    .eq("id", sourcePatient.id);

  if (archiveSourceError) {
    return {
      success: false,
      message: archiveSourceError.message,
    };
  }

  await logAuditEvent({
    clinicId: actor.clinic_id,
    actorStaffId: actor.id,
    action: "patient.merged",
    targetType: "patient",
    targetId: sourcePatient.id,
    details: {
      sourcePatientId: sourcePatient.id,
      sourceMrn: sourcePatient.mrn,
      targetPatientId: targetPatient.id,
      targetMrn: targetPatient.mrn,
      reason: mergeReason,
    },
  });

  revalidatePatientPaths(sourcePatient.id);
  revalidatePatientPaths(targetPatient.id);

  return {
    success: true,
    message: `Merged ${sourcePatient.full_name} into ${targetPatient.full_name}.`,
    patientId: sourcePatient.id,
    redirectPatientId: targetPatient.id,
  };
}

async function generateMRN(supabase: SupabaseServerClient, clinicId: string) {
  const { count } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  const nextNum = (count ?? 0) + 1;
  return `P${nextNum.toString().padStart(5, "0")}`;
}

async function getPatientRecord(supabase: SupabaseServerClient, patientId: string) {
  const { data } = await supabase
    .from("patients")
    .select(
      "id, full_name, mrn, ic_number, date_of_birth, gender, phone, email, address, emergency_contact_name, emergency_contact_phone, allergies, medical_history, archived_at, archived_reason, merged_into_patient_id"
    )
    .eq("id", patientId)
    .maybeSingle();

  return (data as PatientRecord | null) ?? null;
}

async function findDuplicatePatientMatches(
  supabase: SupabaseServerClient,
  patient: ParsedPatientInput,
  excludePatientId?: string
) {
  const duplicateMap = new Map<string, PatientDuplicateMatch>();

  const addReason = (
    match: Pick<Tables<"patients">, "id" | "full_name" | "mrn">,
    reason: string
  ) => {
    const existing = duplicateMap.get(match.id);
    if (existing) {
      if (!existing.reasons.includes(reason)) {
        existing.reasons.push(reason);
      }
      return;
    }

    duplicateMap.set(match.id, {
      id: match.id,
      fullName: match.full_name,
      mrn: match.mrn,
      reasons: [reason],
    });
  };

  const exactChecks = [
    {
      enabled: Boolean(patient.icNumber),
      column: "ic_number" as const,
      value: patient.icNumber,
      reason: "Same IC number",
    },
    {
      enabled: Boolean(patient.phone),
      column: "phone" as const,
      value: patient.phone,
      reason: "Same phone number",
    },
    {
      enabled: Boolean(patient.email),
      column: "email" as const,
      value: patient.email,
      reason: "Same email address",
    },
  ];

  await Promise.all(
    exactChecks.map(async (check) => {
      if (!check.enabled || !check.value) {
        return;
      }

      let query = supabase
        .from("patients")
        .select("id, full_name, mrn")
        .eq(check.column, check.value)
        .is("archived_at", null);

      if (excludePatientId) {
        query = query.neq("id", excludePatientId);
      }

      const { data } = await query.limit(5);
      (data ?? []).forEach((match) => addReason(match, check.reason));
    })
  );

  if (patient.dateOfBirth) {
    let likelyQuery = supabase
      .from("patients")
      .select("id, full_name, mrn")
      .ilike("full_name", patient.fullName)
      .eq("date_of_birth", patient.dateOfBirth)
      .is("archived_at", null);

    if (excludePatientId) {
      likelyQuery = likelyQuery.neq("id", excludePatientId);
    }

    const { data } = await likelyQuery.limit(5);
    (data ?? []).forEach((match) => addReason(match, "Same full name and date of birth"));
  }

  return Array.from(duplicateMap.values());
}

function buildPatientPayload(
  clinicId: string,
  mrn: string,
  patient: ParsedPatientInput
) {
  return {
    clinic_id: clinicId,
    mrn,
    full_name: patient.fullName,
    ic_number: patient.icNumber ?? null,
    date_of_birth: patient.dateOfBirth ?? null,
    gender: patient.gender ?? null,
    phone: patient.phone ?? null,
    email: patient.email ?? null,
    address: patient.address ?? null,
    emergency_contact_name: patient.emergencyContactName ?? null,
    emergency_contact_phone: patient.emergencyContactPhone ?? null,
    allergies: splitCsv(patient.allergies),
    medical_history: {
      conditions: splitCsv(patient.medicalConditions),
      currentMedications: splitCsv(patient.currentMedications),
      surgicalHistory: patient.surgicalHistory ?? null,
      familyHistory: patient.familyHistory ?? null,
      socialHistory: patient.socialHistory ?? null,
      notes: patient.medicalNotes ?? null,
    },
  };
}

function buildMergedPatientUpdate(targetPatient: PatientRecord, sourcePatient: PatientRecord) {
  const targetMedicalHistory = parseMedicalHistory(targetPatient.medical_history);
  const sourceMedicalHistory = parseMedicalHistory(sourcePatient.medical_history);

  return {
    ic_number: targetPatient.ic_number ?? sourcePatient.ic_number,
    date_of_birth: targetPatient.date_of_birth ?? sourcePatient.date_of_birth,
    gender: targetPatient.gender ?? sourcePatient.gender,
    phone: targetPatient.phone ?? sourcePatient.phone,
    email: targetPatient.email ?? sourcePatient.email,
    address: targetPatient.address ?? sourcePatient.address,
    emergency_contact_name:
      targetPatient.emergency_contact_name ?? sourcePatient.emergency_contact_name,
    emergency_contact_phone:
      targetPatient.emergency_contact_phone ?? sourcePatient.emergency_contact_phone,
    allergies: uniqueStrings([
      ...(targetPatient.allergies ?? []),
      ...(sourcePatient.allergies ?? []),
    ]),
    medical_history: {
      conditions: uniqueStrings([
        ...targetMedicalHistory.conditions,
        ...sourceMedicalHistory.conditions,
      ]),
      currentMedications: uniqueStrings([
        ...targetMedicalHistory.currentMedications,
        ...sourceMedicalHistory.currentMedications,
      ]),
      surgicalHistory:
        targetMedicalHistory.surgicalHistory ?? sourceMedicalHistory.surgicalHistory,
      familyHistory: targetMedicalHistory.familyHistory ?? sourceMedicalHistory.familyHistory,
      socialHistory: targetMedicalHistory.socialHistory ?? sourceMedicalHistory.socialHistory,
      notes: [targetMedicalHistory.notes, sourceMedicalHistory.notes].filter(Boolean).join("\n\n") || null,
    },
  };
}

function splitCsv(value: string | undefined) {
  if (!value) {
    return [];
  }

  return uniqueStrings(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toFieldErrors(errors: Record<string, string[] | undefined>): PatientFieldErrors {
  const result: PatientFieldErrors = {};

  for (const [key, messages] of Object.entries(errors)) {
    const firstMessage = messages?.[0];
    if (!firstMessage) continue;

    result[key as keyof PatientFieldErrors] = firstMessage;
  }

  return result;
}

function revalidatePatientPaths(patientId: string) {
  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/dashboard");
}
