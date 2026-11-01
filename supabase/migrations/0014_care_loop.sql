-- Care Loop: every actionable screening result becomes a tracked case with one
-- owner, a due date for its current step and a documented closure.

alter table patients
  add column preferred_language text not null default 'en'
    check (preferred_language in ('en', 'ms')),
  add column messaging_consent_at timestamptz;

-- Results arrive here first (manual entry in v1). Unmatched results have no
-- patient yet and stay open until matched.
create table screening_results (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid references patients(id),
  unmatched_name text,
  unmatched_identifier text,
  test_code text not null,
  value_numeric numeric,
  value_text text,
  collected_on date,
  reported_at timestamptz not null default now(),
  source text,
  notes text,
  suggested_urgency text check (suggested_urgency in ('routine', 'soon', 'urgent', 'critical')),
  triage_status text not null default 'pending'
    check (triage_status in ('pending', 'normal', 'actionable')),
  triaged_by uuid references staff(id),
  triaged_at timestamptz,
  triage_note text,
  entered_by uuid references staff(id),
  created_at timestamptz not null default now(),
  check (patient_id is not null or unmatched_name is not null)
);

create index idx_screening_results_clinic_triage on screening_results(clinic_id, triage_status);
create index idx_screening_results_patient on screening_results(patient_id);

create table result_cases (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  result_id uuid not null unique references screening_results(id),
  test_code text not null,
  urgency text not null check (urgency in ('routine', 'soon', 'urgent', 'critical')),
  next_step text not null
    check (next_step in ('clinic_review', 'repeat_test', 'referral', 'same_day_review')),
  next_step_note text,
  state text not null default 'triaged' check (state in (
    'triaged', 'notified', 'acknowledged', 'confirmed', 'referred',
    'accepted', 'attended', 'in_care', 'closed'
  )),
  owner_staff_id uuid not null references staff(id),
  opened_by uuid not null references staff(id),
  opened_at timestamptz not null default now(),
  state_entered_at timestamptz not null default now(),
  current_step_due_at timestamptz,
  appointment_at timestamptz,
  surveillance_due_on date,
  contact_attempts int not null default 0,
  reminders_sent int not null default 0,
  notified_at timestamptz,
  acknowledged_at timestamptz,
  understanding_correct boolean,
  care_started_at timestamptz,
  referral_rejected_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references staff(id),
  closure_reason text check (closure_reason in (
    'completed', 'resolved_on_repeat', 'care_elsewhere', 'declined', 'lost_to_follow_up', 'deceased'
  )),
  closure_note text,
  reopened_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_result_cases_clinic_state on result_cases(clinic_id, state);
create index idx_result_cases_owner on result_cases(owner_staff_id) where state <> 'closed';
create index idx_result_cases_due on result_cases(clinic_id, current_step_due_at) where state <> 'closed';
create index idx_result_cases_patient on result_cases(patient_id);

-- Append-only history of every case change. Feeds the timeline and metrics.
create table case_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  case_id uuid not null references result_cases(id),
  event_type text not null,
  from_state text,
  to_state text,
  actor_staff_id uuid references staff(id),
  actor_label text,
  note text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_case_events_case on case_events(case_id, created_at);

create table patient_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  case_id uuid not null references result_cases(id),
  channel text not null check (channel in ('whatsapp', 'sms', 'call', 'in_person')),
  kind text not null check (kind in ('result_notice', 'reminder', 'call_log')),
  language text not null default 'en' check (language in ('en', 'ms')),
  token_hash text unique,
  expires_at timestamptz,
  sent_by uuid references staff(id),
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  verified_at timestamptz,
  responded_at timestamptz,
  response text check (response in ('understood', 'question', 'call_me')),
  understanding_correct boolean,
  call_outcome text check (call_outcome in ('reached', 'no_answer', 'wrong_number')),
  note text
);

create index idx_patient_messages_case on patient_messages(case_id, sent_at);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  case_id uuid not null references result_cases(id),
  receiving_facility text not null,
  receiving_clinician text,
  specialty text,
  letter text not null,
  status text not null default 'sent'
    check (status in ('sent', 'viewed', 'accepted', 'rejected', 'booked', 'attended')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references staff(id),
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  reject_reason text,
  appointment_on date,
  outcome_note text,
  attended_on date
);

create index idx_referrals_case on referrals(case_id, created_at desc);

alter table screening_results enable row level security;
alter table result_cases enable row level security;
alter table case_events enable row level security;
alter table patient_messages enable row level security;
alter table referrals enable row level security;

create policy "screening_results_clinic_isolation" on screening_results
  for all using (clinic_id = get_user_clinic_id());

create policy "result_cases_clinic_isolation" on result_cases
  for all using (clinic_id = get_user_clinic_id());

create policy "case_events_clinic_read" on case_events
  for select using (clinic_id = get_user_clinic_id());

create policy "case_events_clinic_append" on case_events
  for insert with check (clinic_id = get_user_clinic_id());

create policy "patient_messages_clinic_isolation" on patient_messages
  for all using (clinic_id = get_user_clinic_id());

create policy "referrals_clinic_isolation" on referrals
  for all using (clinic_id = get_user_clinic_id());

-- Turn the module on for existing clinics.
update clinics
set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{modules,loop}', 'true'::jsonb, true)
where settings -> 'modules' is not null;
