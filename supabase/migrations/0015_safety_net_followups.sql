-- Safety-net follow-ups: after a visit where the doctor could not confirm the
-- cause on the spot, the patient gets a timed WhatsApp check-in. Answers are
-- routed by fixed rules: improving closes, a concern goes to a nurse call, a red
-- flag sends emergency advice and alerts a doctor.

create table safety_net_followups (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  encounter_id uuid not null references encounters(id),
  protocol_code text not null,
  protocol_version int not null,
  -- The warning signs the doctor chose to watch, and the questions they produce.
  signs text[] not null default '{}',
  question_ids text[] not null default '{}',
  doctor_note text,
  language text not null default 'en' check (language in ('en', 'ms')),
  state text not null default 'scheduled' check (state in (
    'scheduled', 'awaiting_reply', 'answering', 'needs_call', 'escalated', 'closed'
  )),
  route text check (route in ('green', 'amber', 'red')),
  call_reason text check (call_reason in ('amber', 'no_reply', 'incomplete', 'patient_message')),
  answers jsonb not null default '{}',
  owner_staff_id uuid not null references staff(id),
  created_by uuid not null references staff(id),
  checkin_due_at timestamptz not null,
  current_step_due_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  completed_at timestamptz,
  escalated_at timestamptz,
  call_attempts int not null default 0,
  closed_at timestamptz,
  closed_by uuid references staff(id),
  closure_reason text check (closure_reason in (
    'improved', 'review_booked', 'blood_test', 'sent_to_emergency', 'unreachable', 'cancelled'
  )),
  closure_note text,
  -- What Claude suggested, kept beside what the doctor confirmed.
  ai_suggestion jsonb,
  -- Link to the simulated phone. Prototype only: real WhatsApp needs no link.
  sim_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_safety_net_clinic_state on safety_net_followups(clinic_id, state);
create index idx_safety_net_due on safety_net_followups(current_step_due_at) where state <> 'closed';
create index idx_safety_net_patient on safety_net_followups(patient_id);
create unique index idx_safety_net_one_open_per_encounter
  on safety_net_followups(encounter_id) where state <> 'closed';

-- The WhatsApp conversation, both directions.
create table safety_net_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  followup_id uuid not null references safety_net_followups(id),
  direction text not null check (direction in ('out', 'in')),
  kind text not null check (kind in ('template', 'question', 'text', 'button_reply')),
  body text not null,
  question_id text,
  options jsonb,
  reply_value text,
  created_at timestamptz not null default now()
);

create index idx_safety_net_messages_followup on safety_net_messages(followup_id, created_at);

-- Append-only history: the timeline on each follow-up.
create table safety_net_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  followup_id uuid not null references safety_net_followups(id),
  event_type text not null,
  actor_staff_id uuid references staff(id),
  actor_label text,
  note text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_safety_net_events_followup on safety_net_events(followup_id, created_at);

alter table safety_net_followups enable row level security;
alter table safety_net_messages enable row level security;
alter table safety_net_events enable row level security;

create policy "safety_net_followups_clinic_isolation" on safety_net_followups
  for all using (clinic_id = get_user_clinic_id());

create policy "safety_net_messages_clinic_read" on safety_net_messages
  for select using (clinic_id = get_user_clinic_id());

create policy "safety_net_messages_clinic_append" on safety_net_messages
  for insert with check (clinic_id = get_user_clinic_id());

create policy "safety_net_events_clinic_read" on safety_net_events
  for select using (clinic_id = get_user_clinic_id());

create policy "safety_net_events_clinic_append" on safety_net_events
  for insert with check (clinic_id = get_user_clinic_id());
