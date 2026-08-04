-- Default enquiry module flag and sample enquiries for local development

update clinics
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{modules,enquiry}',
  'true'::jsonb,
  true
)
where slug = 'rimbun-demo';

insert into enquiries (
  clinic_id,
  source,
  status,
  contact_name,
  contact_phone,
  contact_email,
  subject,
  notes,
  scheduled_at,
  recorded_by
)
select
  clinics.id,
  sample.source,
  sample.status,
  sample.contact_name,
  sample.contact_phone,
  sample.contact_email,
  sample.subject,
  sample.notes,
  sample.scheduled_at,
  staff.id
from clinics
cross join lateral (
  values
    (
      'call'::text,
      'new'::text,
      'Siti Aminah',
      '+60 12-345 6789',
      'siti.aminah@example.com',
      'General consultation enquiry',
      'Caller asked about GP consultation fees and same-day availability.',
      null::timestamptz
    ),
    (
      'walk_in',
      'in_progress',
      'Raj Kumar',
      '+60 17-888 1234',
      null,
      'Walk-in health screening',
      'Interested in basic health screening package. Reception is preparing brochure.',
      null::timestamptz
    ),
    (
      'appointment',
      'scheduled',
      'Lee Wei Ming',
      '+60 19-222 3344',
      'lee.weiming@example.com',
      'Follow-up blood pressure review',
      'Returning patient requested appointment next week.',
      now() + interval '3 days'
    ),
    (
      'follow_up',
      'scheduled',
      'Nurul Izzah',
      '+60 11-555 6677',
      null,
      'Post-consultation follow-up',
      'Doctor requested follow-up call after medication adjustment.',
      now() + interval '7 days'
    )
) as sample(source, status, contact_name, contact_phone, contact_email, subject, notes, scheduled_at)
left join lateral (
  select id
  from staff
  where staff.clinic_id = clinics.id
    and staff.role = 'receptionist'
    and staff.is_active = true
  order by created_at
  limit 1
) as staff on true
where clinics.slug = 'rimbun-demo'
  and not exists (
    select 1
    from enquiries
    where enquiries.clinic_id = clinics.id
      and enquiries.contact_name = sample.contact_name
      and enquiries.subject = sample.subject
  );

insert into enquiry_reminders (
  clinic_id,
  enquiry_id,
  reminder_type,
  status,
  notification_channel,
  remind_at,
  message,
  created_by
)
select
  enquiries.clinic_id,
  enquiries.id,
  case enquiries.source
    when 'appointment' then 'appointment'
    when 'follow_up' then 'follow_up'
    else 'callback'
  end,
  'pending',
  'in_app',
  coalesce(enquiries.scheduled_at, now() + interval '1 day'),
  'Reminder: ' || coalesce(enquiries.subject, 'Follow up with ' || enquiries.contact_name),
  enquiries.recorded_by
from enquiries
join clinics on clinics.id = enquiries.clinic_id
where clinics.slug = 'rimbun-demo'
  and enquiries.status in ('new', 'in_progress', 'scheduled')
  and not exists (
    select 1
    from enquiry_reminders
    where enquiry_reminders.enquiry_id = enquiries.id
  );
