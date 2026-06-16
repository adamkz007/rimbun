alter table encounters
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references staff(id),
  add column if not exists amendment_started_at timestamptz,
  add column if not exists amendment_started_by uuid references staff(id),
  add column if not exists last_amended_at timestamptz,
  add column if not exists last_amended_by uuid references staff(id);

update encounters
set
  completed_at = coalesce(completed_at, updated_at, created_at),
  completed_by = coalesce(completed_by, doctor_id)
where status in ('completed', 'amended')
  and (completed_at is null or completed_by is null);

update encounters
set
  last_amended_at = coalesce(last_amended_at, updated_at, completed_at, created_at),
  last_amended_by = coalesce(last_amended_by, completed_by, doctor_id)
where status = 'amended'
  and (last_amended_at is null or last_amended_by is null);

create index if not exists idx_encounters_completed_at on encounters(completed_at);
create index if not exists idx_encounters_last_amended_at on encounters(last_amended_at);
