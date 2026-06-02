import type { Tables } from "@/types/database";

export const DEFAULT_PATIENT_PAGE_SIZE = 10;

export const PATIENT_SORT_OPTIONS = ["recent", "oldest", "name", "mrn"] as const;
export const PATIENT_ARCHIVE_STATUSES = ["active", "archived", "all"] as const;
export const PATIENT_GENDERS = ["male", "female", "other"] as const;

export type PatientSortOption = (typeof PATIENT_SORT_OPTIONS)[number];
export type PatientArchiveStatus = (typeof PATIENT_ARCHIVE_STATUSES)[number];
export type PatientGender = (typeof PATIENT_GENDERS)[number];

export type PatientFormValues = {
  fullName: string;
  icNumber: string;
  dateOfBirth: string;
  gender: PatientGender | "";
  phone: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  medicalConditions: string;
  currentMedications: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  medicalNotes: string;
};

export type PatientFieldErrors = Partial<Record<keyof PatientFormValues, string>>;

export type PatientDuplicateMatch = {
  id: string;
  fullName: string;
  mrn: string;
  reasons: string[];
};

export type PatientActionResult = {
  success: boolean;
  message: string;
  fieldErrors?: PatientFieldErrors;
  duplicateMatches?: PatientDuplicateMatch[];
  patientId?: string;
  redirectPatientId?: string;
};

export type PatientMedicalHistory = {
  conditions: string[];
  currentMedications: string[];
  surgicalHistory: string | null;
  familyHistory: string | null;
  socialHistory: string | null;
  notes: string | null;
};

type PatientRecordForForm = Pick<
  Tables<"patients">,
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
>;

export const EMPTY_PATIENT_FORM_VALUES: PatientFormValues = {
  fullName: "",
  icNumber: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  allergies: "",
  medicalConditions: "",
  currentMedications: "",
  surgicalHistory: "",
  familyHistory: "",
  socialHistory: "",
  medicalNotes: "",
};

export function patientToFormValues(patient: PatientRecordForForm): PatientFormValues {
  const medicalHistory = parseMedicalHistory(patient.medical_history);

  return {
    fullName: patient.full_name ?? "",
    icNumber: patient.ic_number ?? "",
    dateOfBirth: patient.date_of_birth ?? "",
    gender: patient.gender ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    address: patient.address ?? "",
    emergencyContactName: patient.emergency_contact_name ?? "",
    emergencyContactPhone: patient.emergency_contact_phone ?? "",
    allergies: (patient.allergies ?? []).join(", "),
    medicalConditions: medicalHistory.conditions.join(", "),
    currentMedications: medicalHistory.currentMedications.join(", "),
    surgicalHistory: medicalHistory.surgicalHistory ?? "",
    familyHistory: medicalHistory.familyHistory ?? "",
    socialHistory: medicalHistory.socialHistory ?? "",
    medicalNotes: medicalHistory.notes ?? "",
  };
}

export function parseMedicalHistory(
  medicalHistory: Tables<"patients">["medical_history"] | null | undefined
): PatientMedicalHistory {
  const source = medicalHistory ?? {};

  return {
    conditions: toStringArray(source.conditions),
    currentMedications: toStringArray(source.currentMedications),
    surgicalHistory: toNullableString(source.surgicalHistory),
    familyHistory: toNullableString(source.familyHistory),
    socialHistory: toNullableString(source.socialHistory),
    notes: toNullableString(source.notes),
  };
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
