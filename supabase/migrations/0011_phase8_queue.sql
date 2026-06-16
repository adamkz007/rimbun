-- Phase 8: Queue management for walk-in and appointment arrivals

create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  encounter_id uuid references encounters(id) on delete set null,
  assigned_doctor_id uuid references staff(id),
  status text not null default 'waiting' check (status in (
    'waiting', 'with_nurse', 'with_doctor', 'completed', 'cancelled'
  )),
  arrival_type text not null default 'walk_in' check (arrival_type in ('walk_in', 'appointment')),
  queue_number int not null,
  sort_order int not null default 0,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references staff(id),
  status_updated_at timestamptz not null default now(),
  notes text,
  cancelled_at timestamptz,
  cancelled_by uuid references staff(id),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_queue_entries_clinic_status on queue_entries(clinic_id, status);
create index idx_queue_entries_clinic_checked_in on queue_entries(clinic_id, checked_in_at desc);
create index idx_queue_entries_patient on queue_entries(patient_id);
create index idx_queue_entries_encounter on queue_entries(encounter_id);
create index idx_queue_entries_active_order on queue_entries(clinic_id, sort_order, checked_in_at)
  where status in ('waiting', 'with_nurse', 'with_doctor');

create or replace function next_queue_number(p_clinic_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(queue_number), 0) + 1
  from queue_entries
  where clinic_id = p_clinic_id
    and checked_in_at >= date_trunc('day', now())
    and checked_in_at < date_trunc('day', now()) + interval '1 day';
$$;

alter table queue_entries enable row level security;

create policy "queue_entries_clinic_isolation" on queue_entries
  for all using (clinic_id = get_user_clinic_id());
