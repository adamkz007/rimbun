-- Second clinic fixture for RLS isolation integration tests

insert into clinics (
  name,
  slug,
  address,
  phone,
  registration_number,
  settings
)
select
  'Rimbun Other Clinic',
  'rimbun-other',
  'Other address',
  '+60 3-0000 0001',
  'OTHER-001',
  '{"modules":{"clerking":true,"queue":true,"billing":true,"dispensary":true,"enquiry":true,"attendance":true}}'::jsonb
where not exists (
  select 1 from clinics where slug = 'rimbun-other'
);

insert into patients (
  clinic_id,
  mrn,
  full_name,
  phone,
  allergies,
  medical_history
)
select
  clinics.id,
  'P99999',
  'Other Clinic Patient',
  '+60 19-999 9999',
  '{}',
  '{}'::jsonb
from clinics
where clinics.slug = 'rimbun-other'
  and not exists (
    select 1
    from patients
    where patients.clinic_id = clinics.id
      and patients.mrn = 'P99999'
  );
