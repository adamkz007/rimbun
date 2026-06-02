-- Row Level Security policies for multi-tenant isolation

alter table clinics enable row level security;
alter table staff enable row level security;
alter table patients enable row level security;
alter table encounters enable row level security;
alter table encounter_vitals enable row level security;
alter table encounter_notes enable row level security;
alter table encounter_diagnoses enable row level security;
alter table encounter_prescriptions enable row level security;
alter table encounter_scratchpads enable row level security;
alter table icd10_codes enable row level security;
alter table drugs enable row level security;

-- Helper: get current user's clinic_id
create or replace function get_user_clinic_id()
returns uuid
language sql
stable
security definer
as $$
  select clinic_id from staff where auth_user_id = auth.uid()
$$;

-- Clinic isolation policies
create policy "staff_clinic_isolation" on staff
  for all using (clinic_id = get_user_clinic_id());

create policy "patients_clinic_isolation" on patients
  for all using (clinic_id = get_user_clinic_id());

create policy "encounters_clinic_isolation" on encounters
  for all using (clinic_id = get_user_clinic_id());

create policy "encounter_vitals_isolation" on encounter_vitals
  for all using (
    exists (select 1 from encounters where id = encounter_id and clinic_id = get_user_clinic_id())
  );

create policy "encounter_notes_isolation" on encounter_notes
  for all using (
    exists (select 1 from encounters where id = encounter_id and clinic_id = get_user_clinic_id())
  );

create policy "encounter_diagnoses_isolation" on encounter_diagnoses
  for all using (
    exists (select 1 from encounters where id = encounter_id and clinic_id = get_user_clinic_id())
  );

create policy "encounter_prescriptions_isolation" on encounter_prescriptions
  for all using (
    exists (select 1 from encounters where id = encounter_id and clinic_id = get_user_clinic_id())
  );

create policy "encounter_scratchpads_isolation" on encounter_scratchpads
  for all using (
    exists (select 1 from encounters where id = encounter_id and clinic_id = get_user_clinic_id())
  );

-- Reference data: readable by all authenticated users
create policy "icd10_public_read" on icd10_codes
  for select using (auth.role() = 'authenticated');

create policy "drugs_public_read" on drugs
  for select using (auth.role() = 'authenticated');

-- Clinics: users can only see their own clinic
create policy "clinics_own_only" on clinics
  for select using (id = get_user_clinic_id());
