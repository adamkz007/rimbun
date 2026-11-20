-- Care Loop concept screens: adaptive safety-net check-ins, doctor sign-off,
-- the follow-up to Care Loop bridge and the clinician thread on referrals.

-- Follow-ups --------------------------------------------------------------

alter table safety_net_followups
  drop constraint if exists safety_net_followups_state_check,
  drop constraint if exists safety_net_followups_call_reason_check;

alter table safety_net_followups
  add constraint safety_net_followups_state_check check (state in (
    'scheduled', 'awaiting_reply', 'answering', 'needs_call', 'escalated', 'ready_to_close', 'closed'
  )),
  add constraint safety_net_followups_call_reason_check check (call_reason in (
    'amber', 'no_reply', 'incomplete', 'patient_message', 'unsure', 'kept_open'
  ));

alter table safety_net_followups
  -- The possible causes the check-in tells apart: [{cause, initial, level, questionId?, value?}].
  add column differential jsonb not null default '[]',
  -- The one question the patient can answer now.
  add column pending_question_id text,
  add column route_changed_at timestamptz,
  -- Doctor decisions.
  add column review_at timestamptz,
  add column ordered_test_code text,
  -- Claude's read of the answers, kept beside what the doctor decided.
  add column ai_read jsonb;

update safety_net_followups set pending_question_id = 'opener' where state = 'awaiting_reply';

-- Follow-up to Care Loop bridge -------------------------------------------

alter table result_cases
  add column followup_id uuid references safety_net_followups(id);

create index idx_result_cases_followup on result_cases(followup_id) where followup_id is not null;

-- Referrals: appointment details and a two-way clinician thread -----------

alter table referrals
  add column appointment_time text,
  add column appointment_place text;

create table referral_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  referral_id uuid not null references referrals(id),
  author_side text not null check (author_side in ('clinic', 'receiver')),
  author_name text not null,
  author_staff_id uuid references staff(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index idx_referral_messages_referral on referral_messages(referral_id, created_at);

alter table referral_messages enable row level security;

create policy "referral_messages_clinic_read" on referral_messages
  for select using (clinic_id = get_user_clinic_id());

create policy "referral_messages_clinic_append" on referral_messages
  for insert with check (clinic_id = get_user_clinic_id() and author_side = 'clinic');
