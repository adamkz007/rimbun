-- Foundation tables for multi-tenant GP clinic management

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  phone text,
  registration_number text,
  logo_url text,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  clinic_id uuid not null references clinics(id),
  full_name text not null,
  role text not null check (role in ('admin', 'doctor', 'nurse', 'receptionist')),
  mmc_number text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  ic_number text,
  mrn text not null,
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  allergies text[] default '{}',
  medical_history jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(clinic_id, mrn)
);

create index idx_staff_clinic on staff(clinic_id);
create index idx_staff_auth_user on staff(auth_user_id);
create index idx_patients_clinic on patients(clinic_id);
create index idx_patients_mrn on patients(clinic_id, mrn);
create index idx_patients_name on patients(clinic_id, full_name);
