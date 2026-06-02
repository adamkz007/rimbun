alter table patients
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text,
  add column if not exists merged_into_patient_id uuid references patients(id);

create index if not exists idx_patients_archived on patients(clinic_id, archived_at);
create index if not exists idx_patients_merged_into on patients(merged_into_patient_id);
