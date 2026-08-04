-- Phase 11: Enquiry management — leads, appointments, and follow-up reminders

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  source text not null check (source in ('call', 'walk_in', 'follow_up', 'appointment')),
  status text not null default 'new' check (status in (
    'new', 'in_progress', 'scheduled', 'converted', 'closed', 'cancelled'
  )),
  contact_name text not null,
  contact_phone text,
  contact_email text,
  subject text,
  notes text,
  patient_id uuid references patients(id) on delete set null,
  converted_patient_id uuid references patients(id) on delete set null,
  scheduled_at timestamptz,
  assigned_to uuid references staff(id) on delete set null,
  recorded_by uuid references staff(id),
  converted_at timestamptz,
  converted_by uuid references staff(id),
  closed_at timestamptz,
  closed_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_enquiries_clinic_status on enquiries(clinic_id, status, created_at desc);
create index idx_enquiries_clinic_scheduled on enquiries(clinic_id, scheduled_at)
  where scheduled_at is not null;
create index idx_enquiries_patient on enquiries(patient_id) where patient_id is not null;
create index idx_enquiries_converted_patient on enquiries(converted_patient_id)
  where converted_patient_id is not null;

create table enquiry_reminders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('follow_up', 'appointment', 'callback')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed', 'failed')),
  notification_channel text not null default 'in_app' check (
    notification_channel in ('in_app', 'email', 'sms')
  ),
  remind_at timestamptz not null,
  message text,
  sent_at timestamptz,
  dismissed_at timestamptz,
  dismissed_by uuid references staff(id),
  created_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_enquiry_reminders_clinic_status on enquiry_reminders(clinic_id, status, remind_at);
create index idx_enquiry_reminders_due on enquiry_reminders(clinic_id, remind_at)
  where status = 'pending';
create index idx_enquiry_reminders_enquiry on enquiry_reminders(enquiry_id, remind_at desc);

alter table enquiries enable row level security;
alter table enquiry_reminders enable row level security;

create policy "enquiries_clinic_isolation" on enquiries
  for all using (clinic_id = get_user_clinic_id());

create policy "enquiry_reminders_clinic_isolation" on enquiry_reminders
  for all using (clinic_id = get_user_clinic_id());
