import type { StaffRole, NoteSection } from "@/types/database";

export const ROLES: { value: StaffRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
];

export const NOTE_SECTIONS: { value: NoteSection; label: string }[] = [
  { value: "chief_complaint", label: "Chief Complaint" },
  { value: "history", label: "History" },
  { value: "examination", label: "Examination" },
  { value: "assessment", label: "Assessment" },
  { value: "plan", label: "Plan" },
  { value: "general_notes", label: "General Notes" },
];

export const VITAL_FIELDS = [
  { key: "blood_pressure_systolic", label: "BP Systolic", unit: "mmHg" },
  { key: "blood_pressure_diastolic", label: "BP Diastolic", unit: "mmHg" },
  { key: "heart_rate", label: "Heart Rate", unit: "bpm" },
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "respiratory_rate", label: "Resp. Rate", unit: "/min" },
  { key: "spo2", label: "SpO2", unit: "%" },
  { key: "weight", label: "Weight", unit: "kg" },
  { key: "height", label: "Height", unit: "cm" },
] as const;

export const DRUG_FREQUENCIES = [
  { value: "OD", label: "OD (Once daily)" },
  { value: "BD", label: "BD (Twice daily)" },
  { value: "TDS", label: "TDS (Three times daily)" },
  { value: "QID", label: "QID (Four times daily)" },
  { value: "PRN", label: "PRN (As needed)" },
  { value: "STAT", label: "STAT (Immediately)" },
  { value: "ON", label: "ON (At night)" },
  { value: "OM", label: "OM (Morning)" },
];

export const DRUG_ROUTES = [
  { value: "oral", label: "Oral" },
  { value: "topical", label: "Topical" },
  { value: "injection", label: "Injection" },
  { value: "inhalation", label: "Inhalation" },
  { value: "sublingual", label: "Sublingual" },
  { value: "rectal", label: "Rectal" },
  { value: "other", label: "Other" },
] as const;
