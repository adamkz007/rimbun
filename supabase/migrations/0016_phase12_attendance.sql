-- Phase 12: Attendance — shifts, clock-in/out, and leave management

create table staff_shifts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  staff_id uuid not null references staff(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  notes text,
  created_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (end_time > start_time)
);

create index idx_staff_shifts_clinic_date on staff_shifts(clinic_id, shift_date, status);
create index idx_staff_shifts_staff_date on staff_shifts(staff_id, shift_date desc);
create unique index idx_staff_shifts_unique_slot on staff_shifts(clinic_id, staff_id, shift_date, start_time)
  where status = 'scheduled';

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  staff_id uuid not null references staff(id) on delete cascade,
  shift_id uuid references staff_shifts(id) on delete set null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  status text not null default 'clocked_in' check (status in (
    'clocked_in', 'clocked_out', 'missed', 'adjusted'
  )),
  notes text,
  recorded_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);

create index idx_attendance_records_clinic_status on attendance_records(clinic_id, status, clock_in_at desc);
create index idx_attendance_records_staff on attendance_records(staff_id, clock_in_at desc);
create index idx_attendance_records_shift on attendance_records(shift_id) where shift_id is not null;
create unique index idx_attendance_records_active_clock_in on attendance_records(staff_id)
  where status = 'clocked_in';

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  staff_id uuid not null references staff(id) on delete cascade,
  leave_type text not null check (leave_type in ('annual', 'sick', 'unpaid', 'emergency')),
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  start_date date not null,
  end_date date not null,
  reason text,
  reviewed_by uuid references staff(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (end_date >= start_date)
);

create index idx_leave_requests_clinic_status on leave_requests(clinic_id, status, start_date);
create index idx_leave_requests_staff on leave_requests(staff_id, start_date desc);
create index idx_leave_requests_pending on leave_requests(clinic_id, created_at desc)
  where status = 'pending';

alter table staff_shifts enable row level security;
alter table attendance_records enable row level security;
alter table leave_requests enable row level security;

create policy "staff_shifts_clinic_isolation" on staff_shifts
  for all using (clinic_id = get_user_clinic_id());

create policy "attendance_records_clinic_isolation" on attendance_records
  for all using (clinic_id = get_user_clinic_id());

create policy "leave_requests_clinic_isolation" on leave_requests
  for all using (clinic_id = get_user_clinic_id());
