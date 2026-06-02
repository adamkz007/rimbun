-- Phase 2 hardening: staff management metadata and clinic-scoped audit logging

alter table staff
  add column if not exists email text;

update staff s
set email = u.email
from auth.users u
where s.auth_user_id = u.id
  and s.email is null;

alter table staff
  alter column email set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_clinic_email_unique'
  ) then
    alter table staff
      add constraint staff_clinic_email_unique unique (clinic_id, email);
  end if;
end $$;

create index if not exists idx_staff_clinic_email on staff (clinic_id, lower(email));

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  actor_staff_id uuid references staff(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz default now()
);

create index idx_audit_logs_clinic_created_at on audit_logs(clinic_id, created_at desc);
create index idx_audit_logs_target on audit_logs(target_type, target_id);

alter table audit_logs enable row level security;

create policy "audit_logs_clinic_isolation" on audit_logs
  for select using (clinic_id = get_user_clinic_id());

create policy "audit_logs_insert_own_clinic" on audit_logs
  for insert with check (clinic_id = get_user_clinic_id());
