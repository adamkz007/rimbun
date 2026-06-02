-- Clerking module tables

create table encounters (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  doctor_id uuid not null references staff(id),
  encounter_date timestamptz default now(),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'amended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table encounter_vitals (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  blood_pressure_systolic int,
  blood_pressure_diastolic int,
  heart_rate int,
  temperature numeric(4,1),
  respiratory_rate int,
  spo2 int,
  weight numeric(5,1),
  height numeric(5,1),
  bmi numeric(4,1),
  recorded_by uuid references staff(id),
  recorded_at timestamptz default now(),
  unique(encounter_id)
);

create table encounter_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  section text not null check (section in (
    'chief_complaint', 'history', 'examination',
    'assessment', 'plan', 'general_notes'
  )),
  content jsonb not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(encounter_id, section)
);

create table encounter_diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  icd10_code text not null,
  icd10_description text not null,
  diagnosis_type text default 'primary' check (diagnosis_type in ('primary', 'secondary')),
  notes text,
  sort_order int default 0
);

create table encounter_prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  drug_id uuid,
  drug_name text not null,
  dosage text not null,
  frequency text not null,
  duration text not null,
  quantity int not null,
  route text default 'oral' check (route in ('oral', 'topical', 'injection', 'inhalation', 'sublingual', 'rectal', 'other')),
  instructions text,
  is_dispensed boolean default false,
  sort_order int default 0
);

create table encounter_scratchpads (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  canvas_data jsonb not null,
  thumbnail_url text,
  label text,
  created_at timestamptz default now(),
  unique(encounter_id)
);

create index idx_encounters_clinic on encounters(clinic_id);
create index idx_encounters_patient on encounters(patient_id);
create index idx_encounters_doctor on encounters(doctor_id);
create index idx_encounters_status on encounters(clinic_id, status);
