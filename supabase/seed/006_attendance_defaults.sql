-- Default attendance module flag and sample shifts/records for local development

update clinics
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{modules,attendance}',
  'true'::jsonb,
  true
)
where slug = 'rimbun-demo';

insert into staff_shifts (
  clinic_id,
  staff_id,
  shift_date,
  start_time,
  end_time,
  notes,
  created_by
)
select
  clinics.id,
  target_staff.id,
  (current_date + offset.days)::date,
  sample.start_time::time,
  sample.end_time::time,
  sample.notes,
  admin_staff.id
from clinics
cross join lateral (
  values
    ('doctor', 0, '08:00', '17:00', 'Regular clinic day'),
    ('nurse', 0, '08:00', '16:00', 'Morning shift'),
    ('receptionist', 1, '09:00', '18:00', 'Front desk coverage'),
    ('doctor', 2, '08:00', '13:00', 'Half-day session')
) as sample(role, days, start_time, end_time, notes)
join lateral (
  select staff.id
  from staff
  where staff.clinic_id = clinics.id
    and staff.role = sample.role
    and staff.is_active = true
  order by staff.created_at
  limit 1
) as target_staff on true
left join lateral (
  select staff.id
  from staff
  where staff.clinic_id = clinics.id
    and staff.role = 'admin'
    and staff.is_active = true
  order by staff.created_at
  limit 1
) as admin_staff on true
where clinics.slug = 'rimbun-demo'
  and not exists (
    select 1
    from staff_shifts
    where staff_shifts.clinic_id = clinics.id
      and staff_shifts.staff_id = target_staff.id
      and staff_shifts.shift_date = (current_date + sample.days)::date
      and staff_shifts.start_time = sample.start_time::time
  );

insert into attendance_records (
  clinic_id,
  staff_id,
  shift_id,
  clock_in_at,
  clock_out_at,
  status,
  notes,
  recorded_by
)
select
  staff_shifts.clinic_id,
  staff_shifts.staff_id,
  staff_shifts.id,
  (staff_shifts.shift_date + staff_shifts.start_time)::timestamptz,
  case
    when staff.role = 'doctor' then (staff_shifts.shift_date + staff_shifts.start_time)::timestamptz + interval '4 hours'
    else null
  end,
  case
    when staff.role = 'doctor' then 'clocked_out'
    else 'clocked_in'
  end,
  case
    when staff.role = 'doctor' then 'Completed morning session'
    else 'Currently on shift'
  end,
  staff_shifts.created_by
from staff_shifts
join staff on staff.id = staff_shifts.staff_id
join clinics on clinics.id = staff_shifts.clinic_id
where clinics.slug = 'rimbun-demo'
  and staff_shifts.status = 'scheduled'
  and staff_shifts.shift_date = current_date
  and staff.role in ('doctor', 'nurse')
  and not exists (
    select 1
    from attendance_records
    where attendance_records.shift_id = staff_shifts.id
  );

insert into leave_requests (
  clinic_id,
  staff_id,
  leave_type,
  status,
  start_date,
  end_date,
  reason
)
select
  clinics.id,
  target_staff.id,
  sample.leave_type,
  sample.status,
  (current_date + sample.start_offset)::date,
  (current_date + sample.end_offset)::date,
  sample.reason
from clinics
cross join lateral (
  values
    ('receptionist', 'annual', 'pending', 14, 16, 'Family travel plans'),
    ('nurse', 'sick', 'approved', -7, -5, 'Medical certificate submitted')
) as sample(role, leave_type, status, start_offset, end_offset, reason)
join lateral (
  select staff.id
  from staff
  where staff.clinic_id = clinics.id
    and staff.role = sample.role
    and staff.is_active = true
  order by staff.created_at
  limit 1
) as target_staff on true
where clinics.slug = 'rimbun-demo'
  and not exists (
    select 1
    from leave_requests
    where leave_requests.clinic_id = clinics.id
      and leave_requests.staff_id = target_staff.id
      and leave_requests.start_date = (current_date + sample.start_offset)::date
      and leave_requests.leave_type = sample.leave_type
  );
