-- Care Loop simulated pilot: synthetic patients and cases across a general
-- clinic's day (families and children, working adults, older adults; routine
-- checks, fever triage and cancer screening). All people are fictional.
-- Runs once: skipped when the demo patients already exist.

create or replace function pg_temp.loop_patient(
  p_clinic uuid, p_mrn text, p_name text, p_ic text, p_dob date, p_gender text,
  p_phone text, p_lang text, p_conditions jsonb default '[]'
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into patients (clinic_id, mrn, full_name, ic_number, date_of_birth, gender, phone,
    preferred_language, messaging_consent_at, medical_history)
  values (p_clinic, p_mrn, p_name, p_ic, p_dob, p_gender, p_phone, p_lang, now() - interval '60 days',
    jsonb_build_object('conditions', p_conditions))
  returning id into v_id;
  return v_id;
end $$;

create or replace function pg_temp.loop_result(
  p_clinic uuid, p_patient uuid, p_test text, p_num numeric, p_text text,
  p_suggested text, p_reported timestamptz, p_entered_by uuid, p_source text,
  p_triage text default 'pending', p_triaged_by uuid default null
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into screening_results (clinic_id, patient_id, test_code, value_numeric, value_text,
    collected_on, reported_at, source, suggested_urgency, triage_status, triaged_by, triaged_at, entered_by)
  values (p_clinic, p_patient, p_test, p_num, p_text, (p_reported - interval '1 day')::date, p_reported,
    p_source, p_suggested, p_triage, p_triaged_by,
    case when p_triage = 'pending' then null else p_reported + interval '1 hour' end, p_entered_by)
  returning id into v_id;
  return v_id;
end $$;

-- Opens a case and writes its milestone events. Milestones left null are not reached.
create or replace function pg_temp.loop_case(
  p_clinic uuid, p_patient uuid, p_result uuid, p_test text, p_urgency text, p_next_step text,
  p_note text, p_owner uuid, p_doctor uuid, p_opened timestamptz, p_state text, p_due timestamptz,
  p_notified timestamptz default null, p_ack timestamptz default null, p_understood boolean default null,
  p_care timestamptz default null, p_closed timestamptz default null, p_reason text default null,
  p_closure_note text default null, p_contacts int default 0, p_lang text default 'en'
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into result_cases (clinic_id, patient_id, result_id, test_code, urgency, next_step, next_step_note,
    state, owner_staff_id, opened_by, opened_at, state_entered_at, current_step_due_at, contact_attempts,
    notified_at, acknowledged_at, understanding_correct, care_started_at, closed_at, closed_by,
    closure_reason, closure_note)
  values (p_clinic, p_patient, p_result, p_test, p_urgency, p_next_step, p_note,
    p_state, p_owner, p_doctor, p_opened,
    greatest(p_opened, coalesce(p_notified, p_opened), coalesce(p_ack, p_opened), coalesce(p_care, p_opened), coalesce(p_closed, p_opened)),
    case when p_state = 'closed' then null else p_due end, p_contacts,
    p_notified, p_ack, p_understood, p_care, p_closed,
    case when p_closed is null then null else p_doctor end, p_reason, p_closure_note)
  returning id into v_id;

  insert into case_events (clinic_id, case_id, event_type, to_state, actor_staff_id, note, data, created_at)
  values (p_clinic, v_id, 'opened', 'triaged', p_doctor, p_note,
    jsonb_build_object('urgency', p_urgency, 'nextStep', p_next_step), p_opened);

  if p_notified is not null then
    insert into patient_messages (clinic_id, case_id, channel, kind, language, sent_by, sent_at, opened_at)
    values (p_clinic, v_id, 'whatsapp', 'result_notice', p_lang, p_owner, p_notified,
      case when p_ack is null then null else p_ack - interval '10 minutes' end);
    insert into case_events (clinic_id, case_id, event_type, from_state, to_state, actor_staff_id, data, created_at)
    values (p_clinic, v_id, 'message_sent', 'triaged', 'notified', p_owner,
      jsonb_build_object('channel', 'whatsapp', 'language', p_lang), p_notified);
  end if;

  if p_ack is not null then
    update patient_messages set responded_at = p_ack, response = 'understood', understanding_correct = p_understood,
      verified_at = p_ack - interval '5 minutes'
    where case_id = v_id;
    insert into case_events (clinic_id, case_id, event_type, from_state, to_state, actor_label, data, created_at)
    values (p_clinic, v_id, 'patient_acknowledged', 'notified', 'acknowledged', 'Patient (secure link)',
      jsonb_build_object('understandingCorrect', p_understood, 'language', p_lang), p_ack);
  end if;

  if p_care is not null then
    insert into case_events (clinic_id, case_id, event_type, to_state, actor_staff_id, note, created_at)
    values (p_clinic, v_id, 'advanced', 'attended', p_owner, 'Seen for review.', p_care);
  end if;

  if p_closed is not null then
    insert into case_events (clinic_id, case_id, event_type, to_state, actor_staff_id, note, data, created_at)
    values (p_clinic, v_id, 'closed', 'closed', p_doctor, p_closure_note, jsonb_build_object('reason', p_reason), p_closed);
  end if;

  return v_id;
end $$;

do $$
declare
  v_clinic uuid;
  v_doctor uuid;
  v_nurse uuid;
  v_desk uuid;
  v_patient uuid;
  v_result uuid;
  v_case uuid;
  v_lab constant text := 'Makmal Demo Sdn Bhd';
begin
  select id into v_clinic from clinics where slug = 'rimbun-demo';
  if v_clinic is null then
    raise notice 'Care Loop demo skipped: run 002_bootstrap_clinic.sql first.';
    return;
  end if;
  if exists (select 1 from patients where clinic_id = v_clinic and mrn = 'LOOP-001') then
    raise notice 'Care Loop demo data already present.';
    return;
  end if;

  select id into v_doctor from staff where clinic_id = v_clinic and role = 'doctor' order by created_at limit 1;
  select id into v_nurse from staff where clinic_id = v_clinic and role = 'nurse' order by created_at limit 1;
  select id into v_desk from staff where clinic_id = v_clinic and role = 'receptionist' order by created_at limit 1;

  -- 1. Child with fever: dengue NS1 positive, acknowledged, review booked today.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-001', 'Aina Sofea binti Rahman', '180412-10-0218', '2018-04-12', 'female', '012-000 1001', 'ms');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'dengue_ns1', null, 'positive', 'urgent', now() - interval '20 hours', v_nurse, 'In-clinic rapid test', 'actionable', v_doctor);
  v_case := pg_temp.loop_case(v_clinic, v_patient, v_result, 'dengue_ns1', 'urgent', 'same_day_review',
    'Day 3 of fever. Needs FBC and hydration review; warn parents about warning signs.', v_nurse, v_doctor,
    now() - interval '19 hours', 'acknowledged', now() + interval '29 hours',
    now() - interval '18 hours', now() - interval '17 hours', true, null, null, null, null, 1, 'ms');
  update result_cases set appointment_at = date_trunc('day', now()) + interval '16 hours' where id = v_case;

  -- 2. Working adult, fever triage: low platelets, not yet notified, overdue.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-002', 'Daniel Tan Wei Ming', '920715-14-5531', '1992-07-15', 'male', '012-000 1002', 'en');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'platelets', 88, null, 'urgent', now() - interval '31 hours', v_desk, v_lab, 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'platelets', 'urgent', 'same_day_review',
    'Platelets falling from 140 two days ago. Recall today for repeat FBC.', v_nurse, v_doctor,
    now() - interval '30 hours', 'triaged', now() - interval '6 hours');

  -- 3. Working adult: new diabetes range, reviewed and closed with evidence.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-003', 'Siti Aminah binti Yusof', '810302-08-6624', '1981-03-02', 'female', '012-000 1003', 'ms');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'hba1c', 8.1, null, 'soon', now() - interval '24 days', v_desk, v_lab, 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'hba1c', 'soon', 'clinic_review',
    'New diabetes range. Review, start metformin, diet referral.', v_nurse, v_doctor,
    now() - interval '24 days', 'closed', null,
    now() - interval '23 days', now() - interval '23 days' + interval '3 hours', true,
    now() - interval '17 days', now() - interval '16 days', 'completed',
    'Reviewed 17 days ago. Metformin started, dietitian booked, HbA1c repeat in 3 months.', 1, 'ms');

  -- 4. Colorectal screening: positive FIT, referral sent and viewed but not answered (overdue).
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-004', 'Kumar a/l Raju', '740918-07-5513', '1974-09-18', 'male', '012-000 1004', 'en', '["Hypertension"]');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'fit', null, 'positive', 'soon', now() - interval '9 days', v_desk, v_lab, 'actionable', v_doctor);
  v_case := pg_temp.loop_case(v_clinic, v_patient, v_result, 'fit', 'soon', 'referral',
    'Positive FIT, no prior colonoscopy. Refer for colonoscopy.', v_doctor, v_doctor,
    now() - interval '9 days', 'referred', now() - interval '26 hours',
    now() - interval '9 days' + interval '4 hours', now() - interval '8 days', true, null, null, null, null, 1);
  insert into referrals (clinic_id, case_id, receiving_facility, specialty, letter, status, token_hash, expires_at, created_by, created_at, viewed_at)
  values (v_clinic, v_case, 'Klinik Pakar Gastro (Demo)', 'Gastroenterology / colonoscopy',
    'Demo referral letter for Kumar a/l Raju: positive FIT, please assess for colonoscopy.', 'viewed',
    encode(sha256(convert_to('demo-referral-kumar', 'UTF8')), 'hex'), now() + interval '24 days', v_doctor,
    now() - interval '6 days' - interval '2 hours', now() - interval '5 days');
  update result_cases set state_entered_at = now() - interval '6 days' - interval '2 hours' where id = v_case;
  insert into case_events (clinic_id, case_id, event_type, from_state, to_state, actor_staff_id, data, created_at)
  values (v_clinic, v_case, 'referral_sent', 'acknowledged', 'referred', v_doctor,
    jsonb_build_object('facility', 'Klinik Pakar Gastro (Demo)'), now() - interval '6 days' - interval '2 hours');

  -- 5. Cervical screening: low-grade changes, referral accepted with an appointment.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-005', 'Wong Mei Ling', '880521-10-6040', '1988-05-21', 'female', '012-000 1005', 'en');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'cervical', null, 'low_grade', 'soon', now() - interval '12 days', v_desk, v_lab, 'actionable', v_doctor);
  v_case := pg_temp.loop_case(v_clinic, v_patient, v_result, 'cervical', 'soon', 'referral',
    'Low-grade changes with HPV positive. Refer for colposcopy.', v_nurse, v_doctor,
    now() - interval '12 days', 'accepted', now() + interval '25 days',
    now() - interval '12 days' + interval '2 hours', now() - interval '11 days', true, null, null, null, null, 1);
  insert into referrals (clinic_id, case_id, receiving_facility, specialty, letter, status, token_hash, expires_at, created_by, created_at, viewed_at, responded_at, appointment_on)
  values (v_clinic, v_case, 'Pusat Wanita (Demo)', 'Gynaecology / colposcopy',
    'Demo referral letter for Wong Mei Ling: low-grade cervical changes, please assess for colposcopy.', 'booked',
    encode(sha256(convert_to('demo-referral-meiling', 'UTF8')), 'hex'), now() + interval '20 days', v_doctor,
    now() - interval '10 days', now() - interval '9 days', now() - interval '5 days', (now() + interval '5 days')::date);
  update result_cases set appointment_at = date_trunc('day', now() + interval '5 days') + interval '10 hours',
    state_entered_at = now() - interval '5 days' where id = v_case;
  insert into case_events (clinic_id, case_id, event_type, from_state, to_state, actor_staff_id, actor_label, data, created_at)
  values
    (v_clinic, v_case, 'referral_sent', 'acknowledged', 'referred', v_doctor, null,
      jsonb_build_object('facility', 'Pusat Wanita (Demo)'), now() - interval '10 days'),
    (v_clinic, v_case, 'referral_accepted', 'referred', 'accepted', null, 'Dr. Priya (Pusat Wanita (Demo))',
      jsonb_build_object('facility', 'Pusat Wanita (Demo)', 'appointmentOn', (now() + interval '5 days')::date), now() - interval '5 days');

  -- 6. Older adult: falling kidney function, unreachable after 3 attempts.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-006', 'Rosnah binti Ismail', '570110-01-5872', '1957-01-10', 'female', '012-000 1006', 'ms', '["Type 2 diabetes", "Hypertension"]');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'egfr', 28, null, 'soon', now() - interval '6 days', v_desk, v_lab, 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'egfr', 'soon', 'clinic_review',
    'eGFR 28, down from 41. Review medicines (metformin dose) and refer to nephrology if confirmed.', v_nurse, v_doctor,
    now() - interval '6 days', 'notified', now() - interval '1 day',
    now() - interval '4 days', null, null, null, null, null, null, 3, 'ms');

  -- 7. Older adult on ACE inhibitor: critical potassium, opened 2 hours ago.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-007', 'Lim Ah Kow', '520803-07-5011', '1952-08-03', 'male', '012-000 1007', 'en', '["Heart failure", "Chronic kidney disease"]');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'potassium', 6.2, null, 'critical', now() - interval '3 hours', v_desk, v_lab, 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'potassium', 'critical', 'same_day_review',
    'K 6.2 on ramipril and spironolactone. Call now: hold spironolactone, same-day repeat and ECG.', v_doctor, v_doctor,
    now() - interval '2 hours', 'triaged', now() + interval '6 hours');

  -- 8. Working adult: high blood pressure, acknowledged but picked the wrong next step.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-008', 'Farid bin Hassan', '850127-14-5199', '1985-01-27', 'male', '012-000 1008', 'ms');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'blood_pressure', null, '168/104', 'soon', now() - interval '3 days', v_nurse, 'Workplace health screening', 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'blood_pressure', 'soon', 'clinic_review',
    'Screening BP 168/104, no known hypertension. Review with home BP readings.', v_nurse, v_doctor,
    now() - interval '3 days', 'acknowledged', now() + interval '5 days',
    now() - interval '3 days' + interval '5 hours', now() - interval '2 days', false, null, null, null, null, 1, 'ms');

  -- 9. Breast screening: suspicious mammogram, referral declined (no capacity), back with the owner.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-009', 'Grace Fernandez', '690630-10-5768', '1969-06-30', 'female', '012-000 1009', 'en');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'mammogram', null, '4', 'urgent', now() - interval '5 days', v_desk, 'Pusat Imejan (Demo)', 'actionable', v_doctor);
  v_case := pg_temp.loop_case(v_clinic, v_patient, v_result, 'mammogram', 'urgent', 'referral',
    'BI-RADS 4 left breast. Urgent breast surgical referral for biopsy.', v_doctor, v_doctor,
    now() - interval '5 days', 'acknowledged', now() + interval '20 hours',
    now() - interval '5 days' + interval '2 hours', now() - interval '5 days' + interval '6 hours', true, null, null, null, null, 1);
  insert into referrals (clinic_id, case_id, receiving_facility, specialty, letter, status, token_hash, expires_at, created_by, created_at, viewed_at, responded_at, reject_reason)
  values (v_clinic, v_case, 'Klinik Pakar Payudara (Demo)', 'Breast surgery',
    'Demo referral letter for Grace Fernandez: BI-RADS 4, please assess for biopsy.', 'rejected',
    encode(sha256(convert_to('demo-referral-grace', 'UTF8')), 'hex'), now() + interval '26 days', v_doctor,
    now() - interval '4 days', now() - interval '3 days', now() - interval '28 hours',
    'No biopsy slots for 6 weeks. Please refer to the hospital breast clinic.');
  update result_cases set referral_rejected_at = now() - interval '28 hours', state_entered_at = now() - interval '28 hours' where id = v_case;
  insert into case_events (clinic_id, case_id, event_type, from_state, to_state, actor_staff_id, actor_label, note, data, created_at)
  values
    (v_clinic, v_case, 'referral_sent', 'acknowledged', 'referred', v_doctor, null, null,
      jsonb_build_object('facility', 'Klinik Pakar Payudara (Demo)'), now() - interval '4 days'),
    (v_clinic, v_case, 'referral_rejected', 'referred', 'acknowledged', null, 'Klinik Pakar Payudara (Demo)',
      'No biopsy slots for 6 weeks. Please refer to the hospital breast clinic.',
      jsonb_build_object('facility', 'Klinik Pakar Payudara (Demo)'), now() - interval '28 hours');

  -- 10. Raised PSA, repeat test normal: closed on the repeat.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-010', 'Ahmad Zaki bin Osman', '660214-05-5233', '1966-02-14', 'male', '012-000 1010', 'ms');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'psa', 5.2, null, 'routine', now() - interval '40 days', v_desk, v_lab, 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'psa', 'routine', 'repeat_test',
    'PSA 5.2 after cycling. Repeat in 6 weeks, avoid cycling 48 h before.', v_nurse, v_doctor,
    now() - interval '40 days', 'closed', null,
    now() - interval '38 days', now() - interval '37 days', true, null,
    now() - interval '3 days', 'resolved_on_repeat', 'Repeat PSA 2.9. Routine annual check.', 1, 'ms');

  -- 11. Hepatitis B: closed as lost to follow-up after attempts, doctor sign-off.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-011', 'Nur Hidayah binti Kamal', '970909-03-5560', '1997-09-09', 'female', '012-000 1011', 'ms');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'hbsag', null, 'positive', 'soon', now() - interval '35 days', v_desk, v_lab, 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'hbsag', 'soon', 'clinic_review',
    'New HBsAg positive on pre-employment screen. Review, LFT, viral load, family screening.', v_nurse, v_doctor,
    now() - interval '35 days', 'closed', null,
    now() - interval '34 days', null, null, null,
    now() - interval '6 days', 'lost_to_follow_up',
    'Three WhatsApp attempts and two calls, number no longer in use. Letter posted to home address.', 5, 'ms');

  -- 12. Older adult: anaemia, owned by the doctor, opened today.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-012', 'Muthu a/l Krishnan', '480625-08-5397', '1948-06-25', 'male', '012-000 1012', 'en', '["Atrial fibrillation"]');
  v_result := pg_temp.loop_result(v_clinic, v_patient, 'haemoglobin', 9.1, null, 'soon', now() - interval '5 hours', v_desk, v_lab, 'actionable', v_doctor);
  perform pg_temp.loop_case(v_clinic, v_patient, v_result, 'haemoglobin', 'soon', 'clinic_review',
    'Hb 9.1 on apixaban, was 12.4 last year. Review for GI blood loss; consider FIT and iron studies.', v_doctor, v_doctor,
    now() - interval '4 hours', 'triaged', now() + interval '116 hours');

  -- Results waiting for triage: two flagged, one unmatched, one normal.
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-013', 'Kavitha a/p Subramaniam', '780402-10-5874', '1978-04-02', 'female', '012-000 1013', 'en');
  perform pg_temp.loop_result(v_clinic, v_patient, 'ldl', 5.2, null, 'soon', now() - interval '2 hours', v_desk, v_lab);
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-014', 'Muhammad Haziq bin Azlan', '200119-14-0457', '2020-01-19', 'male', '012-000 1014', 'ms');
  perform pg_temp.loop_result(v_clinic, v_patient, 'haemoglobin', 9.6, null, 'soon', now() - interval '90 minutes', v_desk, v_lab);
  v_patient := pg_temp.loop_patient(v_clinic, 'LOOP-015', 'Aisyah binti Zainal', '900817-10-5182', '1990-08-17', 'female', '012-000 1015', 'ms');
  perform pg_temp.loop_result(v_clinic, v_patient, 'hba1c', 5.3, null, null, now() - interval '1 hour', v_desk, v_lab);
  insert into screening_results (clinic_id, unmatched_name, unmatched_identifier, test_code, value_numeric,
    collected_on, reported_at, source, suggested_urgency, entered_by)
  values (v_clinic, 'TAN BOON HOCK', 'LAB-88213', 'crp', 124, current_date - 1, now() - interval '40 minutes',
    v_lab, 'urgent', v_desk);

  raise notice 'Care Loop demo data created.';
end $$;
