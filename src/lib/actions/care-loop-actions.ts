"use server";

import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import {
  getTest,
  NEXT_STEP_LABELS,
  PATIENT_LANGUAGES,
  suggestUrgency,
  URGENCIES,
  type NextStep,
  type PatientLanguage,
  type Urgency,
} from "@/lib/care-loop/catalogue";
import {
  buildPatientMessage,
  buildSmsLink,
  buildWhatsAppLink,
  firstName,
  identityPrompt,
} from "@/lib/care-loop/messages";
import {
  getRequestOrigin,
  loadCase,
  recordCaseEvent,
  transitionCase,
  updateCase,
  type Actor,
  type Db,
} from "@/lib/care-loop/server";
import { applyReferralUpdate } from "@/lib/care-loop/referral-updates";
import { attempt } from "@/lib/care-loop/result";
import { generateLinkToken } from "@/lib/care-loop/tokens";
import {
  canAdvanceTo,
  canContactPatients,
  canCreateReferrals,
  canEnterResults,
  canProgressCases,
  canReassignCases,
  canReopenCases,
  canTriageResults,
  CASE_STATES,
  checkClosure,
  CLOSURE_REASONS,
  computeDueAt,
  type CaseState,
  type ClosureReason,
} from "@/lib/care-loop/workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/database";

const ALL_STAFF: StaffRole[] = ["admin", "doctor", "nurse", "receptionist"];

async function requireLoopStaff() {
  const staff = await requireActionAccess({ roles: ALL_STAFF, module: "loop" });
  const db: Db = await getSupabaseServerClient();
  return { staff, db, actor: { kind: "staff", staffId: staff.id } as Actor };
}

function assertAllowed(allowed: boolean, message: string) {
  if (!allowed) throw new Error(message);
}

async function assertActiveStaff(db: Db, clinicId: string, staffId: string) {
  const { data, error } = await db
    .from("staff")
    .select("id, is_active")
    .eq("id", staffId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.is_active) throw new Error("Owner must be an active staff member of this clinic.");
}

// ---- F1 Results inbox ----

export async function enterResult(input: {
  patientId?: string | null;
  unmatchedName?: string | null;
  unmatchedIdentifier?: string | null;
  testCode: string;
  valueNumeric?: number | null;
  valueText?: string | null;
  collectedOn?: string | null;
  source?: string | null;
  notes?: string | null;
}) {
  return attempt(async () => {
    const { staff, db } = await requireLoopStaff();
    assertAllowed(canEnterResults(staff.role), "You are not authorized to enter results.");

    const test = getTest(input.testCode);
    if (!test) throw new Error("Unknown test.");
    if (!input.patientId && !input.unmatchedName?.trim()) {
      throw new Error("Select a patient, or enter the name printed on the report.");
    }

    const valueNumeric = test.kind === "numeric" ? input.valueNumeric ?? null : null;
    const valueText = test.kind === "numeric" ? null : input.valueText?.trim() || null;
    if (test.kind === "numeric" && (valueNumeric === null || Number.isNaN(valueNumeric))) {
      throw new Error("Enter the result value.");
    }
    if (test.kind !== "numeric" && !valueText) {
      throw new Error("Enter the result value.");
    }

    if (input.patientId) {
      const { data: patient } = await db
        .from("patients")
        .select("id, archived_at")
        .eq("id", input.patientId)
        .eq("clinic_id", staff.clinic_id)
        .maybeSingle();
      if (!patient || patient.archived_at) throw new Error("Patient not found.");
    }

    const suggested = suggestUrgency(input.testCode, { numeric: valueNumeric, text: valueText });

    const { data, error } = await db
      .from("screening_results")
      .insert({
        clinic_id: staff.clinic_id,
        patient_id: input.patientId || null,
        unmatched_name: input.patientId ? null : input.unmatchedName?.trim() || null,
        unmatched_identifier: input.patientId ? null : input.unmatchedIdentifier?.trim() || null,
        test_code: input.testCode,
        value_numeric: valueNumeric,
        value_text: valueText,
        collected_on: input.collectedOn || null,
        source: input.source?.trim() || null,
        notes: input.notes?.trim() || null,
        suggested_urgency: suggested,
        triage_status: "pending",
        entered_by: staff.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "loop.result_entered",
      targetType: "screening_result",
      targetId: data.id,
      details: { testCode: input.testCode, suggestedUrgency: suggested, matched: !!input.patientId },
    });

    return { id: data.id as string, suggestedUrgency: suggested };
  });
}

export async function matchResultToPatient(resultId: string, patientId: string) {
  return attempt(async () => {
    const { staff, db } = await requireLoopStaff();
    assertAllowed(canEnterResults(staff.role), "You are not authorized to match results.");

    const { data: patient } = await db
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("clinic_id", staff.clinic_id)
      .maybeSingle();
    if (!patient) throw new Error("Patient not found.");

    const { error } = await db
      .from("screening_results")
      .update({ patient_id: patientId })
      .eq("id", resultId)
      .eq("clinic_id", staff.clinic_id)
      .is("patient_id", null);
    if (error) throw new Error(error.message);

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "loop.result_matched",
      targetType: "screening_result",
      targetId: resultId,
      details: { patientId },
    });
  });
}

async function loadPendingResult(db: Db, clinicId: string, resultId: string) {
  const { data, error } = await db
    .from("screening_results")
    .select("*")
    .eq("id", resultId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Result not found.");
  if (data.triage_status !== "pending") throw new Error("This result has already been triaged.");
  return data;
}

export async function fileResultAsNormal(resultId: string, note?: string | null) {
  return attempt(async () => {
    const { staff, db } = await requireLoopStaff();
    assertAllowed(canTriageResults(staff.role), "Only a doctor can triage results.");
    await loadPendingResult(db, staff.clinic_id, resultId);

    const { error } = await db
      .from("screening_results")
      .update({
        triage_status: "normal",
        triaged_by: staff.id,
        triaged_at: new Date().toISOString(),
        triage_note: note?.trim() || null,
      })
      .eq("id", resultId);
    if (error) throw new Error(error.message);

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "loop.result_filed_normal",
      targetType: "screening_result",
      targetId: resultId,
    });
  });
}

export async function openCase(input: {
  resultId: string;
  urgency: Urgency;
  nextStep: NextStep;
  nextStepNote?: string | null;
  ownerStaffId: string;
  /** The safety-net follow-up this result continues (spec section 7). */
  followupId?: string | null;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canTriageResults(staff.role), "Only a doctor can open a case.");
    if (!URGENCIES.includes(input.urgency)) throw new Error("Choose an urgency.");
    if (!(input.nextStep in NEXT_STEP_LABELS)) throw new Error("Choose a next step.");

    const result = await loadPendingResult(db, staff.clinic_id, input.resultId);
    if (!result.patient_id) throw new Error("Match this result to a patient before opening a case.");
    await assertActiveStaff(db, staff.clinic_id, input.ownerStaffId);

    let followupId: string | null = null;
    if (input.followupId) {
      const { data: followup, error: followupError } = await db
        .from("safety_net_followups")
        .select("id, patient_id, state")
        .eq("id", input.followupId)
        .eq("clinic_id", staff.clinic_id)
        .maybeSingle();
      if (followupError) throw new Error(followupError.message);
      if (!followup || followup.patient_id !== result.patient_id || followup.state !== "closed") {
        throw new Error("That follow-up can't be linked to this result.");
      }
      followupId = followup.id;
    }

    const now = new Date().toISOString();
    const { data: created, error } = await db
      .from("result_cases")
      .insert({
        clinic_id: staff.clinic_id,
        patient_id: result.patient_id,
        result_id: result.id,
        test_code: result.test_code,
        urgency: input.urgency,
        next_step: input.nextStep,
        next_step_note: input.nextStepNote?.trim() || null,
        state: "triaged",
        owner_staff_id: input.ownerStaffId,
        opened_by: staff.id,
        opened_at: now,
        state_entered_at: now,
        current_step_due_at: computeDueAt("triaged", input.urgency, now)?.toISOString() ?? null,
        followup_id: followupId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { error: resultError } = await db
      .from("screening_results")
      .update({ triage_status: "actionable", triaged_by: staff.id, triaged_at: now })
      .eq("id", result.id);
    if (resultError) throw new Error(resultError.message);

    await recordCaseEvent(db, created, actor, {
      type: "opened",
      toState: "triaged",
      note: input.nextStepNote,
      data: {
        urgency: input.urgency,
        suggestedUrgency: result.suggested_urgency,
        nextStep: input.nextStep,
        ownerStaffId: input.ownerStaffId,
        followupId,
      },
    });

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "loop.case_opened",
      targetType: "result_case",
      targetId: created.id,
      details: { urgency: input.urgency, testCode: result.test_code },
    });

    return { caseId: created.id as string };
  });
}

// ---- F2 Ownership ----

export async function reassignCase(caseId: string, ownerStaffId: string, reason: string) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canReassignCases(staff.role), "You are not authorized to reassign cases.");
    if (!reason.trim()) throw new Error("Give a reason for the hand-off.");

    const item = await loadCase(db, caseId, staff.clinic_id);
    if (item.state === "closed") throw new Error("Closed cases cannot be reassigned.");
    if (item.owner_staff_id === ownerStaffId) return;
    await assertActiveStaff(db, staff.clinic_id, ownerStaffId);

    await updateCase(db, item, actor, { owner_staff_id: ownerStaffId }, {
      type: "owner_changed",
      note: reason,
      data: { from: item.owner_staff_id, to: ownerStaffId },
    });
  });
}

// ---- F3 Patient messaging ----

export async function recordMessagingConsent(caseId: string, language: PatientLanguage) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canContactPatients(staff.role), "You are not authorized to contact patients.");
    if (!PATIENT_LANGUAGES.includes(language)) throw new Error("Unsupported language.");

    const item = await loadCase(db, caseId, staff.clinic_id);
    const now = new Date().toISOString();
    const { error } = await db
      .from("patients")
      .update({ messaging_consent_at: now, preferred_language: language })
      .eq("id", item.patient_id);
    if (error) throw new Error(error.message);

    await recordCaseEvent(db, item, actor, {
      type: "consent_recorded",
      data: { language },
    });
  });
}

export async function sendPatientMessage(input: {
  caseId: string;
  channel: "whatsapp" | "sms";
  language: PatientLanguage;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canContactPatients(staff.role), "You are not authorized to contact patients.");
    if (!PATIENT_LANGUAGES.includes(input.language)) throw new Error("Unsupported language.");

    const item = await loadCase(db, input.caseId, staff.clinic_id);
    if (item.state === "closed") throw new Error("This case is closed.");

    const { data: patient, error: patientError } = await db
      .from("patients")
      .select("full_name, phone, date_of_birth, ic_number, messaging_consent_at")
      .eq("id", item.patient_id)
      .single();
    if (patientError) throw new Error(patientError.message);
    if (!patient.messaging_consent_at) {
      throw new Error("Record the patient's consent to be messaged first.");
    }
    if (!identityPrompt(patient)) {
      throw new Error("Add the patient's date of birth or IC number so they can verify the link.");
    }

    const isReminder = !!item.notified_at;
    const { token, hash, expiresAt } = generateLinkToken();
    const link = `${await getRequestOrigin()}/r/${token}`;
    const text = buildPatientMessage({
      kind: isReminder ? "reminder" : "result_notice",
      language: input.language,
      patientFirstName: firstName(patient.full_name),
      clinicName: staff.clinics?.name ?? "Your clinic",
      link,
    });
    const openUrl =
      input.channel === "whatsapp"
        ? buildWhatsAppLink(patient.phone, text)
        : buildSmsLink(patient.phone, text);
    if (!openUrl) throw new Error("The patient's phone number is missing or invalid.");

    const { error } = await db.from("patient_messages").insert({
      clinic_id: staff.clinic_id,
      case_id: item.id,
      channel: input.channel,
      kind: isReminder ? "reminder" : "result_notice",
      language: input.language,
      token_hash: hash,
      expires_at: expiresAt.toISOString(),
      sent_by: staff.id,
    });
    if (error) throw new Error(error.message);

    // Remember the language staff chose for this patient.
    await db.from("patients").update({ preferred_language: input.language }).eq("id", item.patient_id);

    const counters = {
      contact_attempts: item.contact_attempts + 1,
      reminders_sent: item.reminders_sent + (isReminder ? 1 : 0),
    };
    const event = {
      type: isReminder ? "reminder_sent" : "message_sent",
      data: { channel: input.channel, language: input.language },
    };

    if (item.state === "triaged") {
      await transitionCase(db, item, "notified", actor, event, counters);
    } else {
      await updateCase(db, item, actor, counters, event);
    }

    return { openUrl, text, link };
  });
}

export async function logPatientContact(input: {
  caseId: string;
  channel: "call" | "in_person";
  outcome: "reached" | "no_answer" | "wrong_number";
  acknowledged: boolean;
  note?: string | null;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canContactPatients(staff.role), "You are not authorized to contact patients.");

    const item = await loadCase(db, input.caseId, staff.clinic_id);
    if (item.state === "closed") throw new Error("This case is closed.");
    const outcome = input.channel === "in_person" ? "reached" : input.outcome;

    const { error } = await db.from("patient_messages").insert({
      clinic_id: staff.clinic_id,
      case_id: item.id,
      channel: input.channel,
      kind: "call_log",
      sent_by: staff.id,
      call_outcome: outcome,
      note: input.note?.trim() || null,
      response: outcome === "reached" && input.acknowledged ? "understood" : null,
      responded_at: outcome === "reached" && input.acknowledged ? new Date().toISOString() : null,
    });
    if (error) throw new Error(error.message);

    const event = {
      type: "contact_logged",
      note: input.note,
      data: { channel: input.channel, outcome, acknowledged: input.acknowledged },
    };
    const counters = { contact_attempts: item.contact_attempts + 1 };

    if (outcome === "reached" && input.acknowledged && (item.state === "triaged" || item.state === "notified")) {
      await transitionCase(db, item, "acknowledged", actor, event, counters);
    } else if (outcome === "reached" && item.state === "triaged") {
      await transitionCase(db, item, "notified", actor, event, counters);
    } else {
      await updateCase(db, item, actor, counters, event);
    }
  });
}

// ---- Progress, referral, closure ----

export async function advanceCase(input: {
  caseId: string;
  toState: CaseState;
  note?: string | null;
  appointmentAt?: string | null;
  surveillanceDueOn?: string | null;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canProgressCases(staff.role), "Only clinical staff can progress a case.");
    if (!CASE_STATES.includes(input.toState)) throw new Error("Unknown step.");

    const item = await loadCase(db, input.caseId, staff.clinic_id);
    if (!canAdvanceTo(item.state, input.toState)) {
      throw new Error("Cases can only move forward. Use close or reopen instead.");
    }
    if (input.toState === "in_care" && !input.note?.trim()) {
      throw new Error("Describe the treatment or surveillance plan.");
    }

    const extra: Record<string, string> = {};
    if (input.appointmentAt) extra.appointment_at = new Date(input.appointmentAt).toISOString();
    if (input.surveillanceDueOn) extra.surveillance_due_on = input.surveillanceDueOn;

    await transitionCase(db, item, input.toState, actor, { type: "advanced", note: input.note }, extra);
  });
}

export async function createReferral(input: {
  caseId: string;
  receivingFacility: string;
  receivingClinician?: string | null;
  specialty?: string | null;
  letter: string;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canCreateReferrals(staff.role), "Only a doctor can send a referral.");
    if (!input.receivingFacility.trim()) throw new Error("Enter the receiving facility.");
    if (!input.letter.trim()) throw new Error("The referral letter is empty.");

    const item = await loadCase(db, input.caseId, staff.clinic_id);
    if (item.state === "closed") throw new Error("This case is closed.");

    const { token, hash, expiresAt } = generateLinkToken();
    const { data: referral, error } = await db
      .from("referrals")
      .insert({
        clinic_id: staff.clinic_id,
        case_id: item.id,
        receiving_facility: input.receivingFacility.trim(),
        receiving_clinician: input.receivingClinician?.trim() || null,
        specialty: input.specialty?.trim() || null,
        letter: input.letter,
        status: "sent",
        token_hash: hash,
        expires_at: expiresAt.toISOString(),
        created_by: staff.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const event = {
      type: "referral_sent",
      data: { referralId: referral.id, facility: input.receivingFacility.trim() },
    };
    if (canAdvanceTo(item.state, "referred")) {
      await transitionCase(db, item, "referred", actor, event, { referral_rejected_at: null });
    } else {
      await updateCase(db, item, actor, { referral_rejected_at: null }, event);
    }

    return { link: `${await getRequestOrigin()}/referral/${token}` };
  });
}

export async function logReferralResponse(input: {
  referralId: string;
  status: "accepted" | "rejected" | "attended";
  rejectReason?: string | null;
  appointmentOn?: string | null;
  outcomeNote?: string | null;
  attendedOn?: string | null;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canProgressCases(staff.role), "Only clinical staff can update referrals.");

    const { data: referral, error } = await db
      .from("referrals")
      .select("*")
      .eq("id", input.referralId)
      .eq("clinic_id", staff.clinic_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!referral) throw new Error("Referral not found.");

    await applyReferralUpdate(db, referral, actor, input);
  });
}

export async function closeCase(input: { caseId: string; reason: ClosureReason; note: string }) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    if (!CLOSURE_REASONS.includes(input.reason)) throw new Error("Choose a closure reason.");

    const item = await loadCase(db, input.caseId, staff.clinic_id);
    const check = checkClosure({ role: staff.role, state: item.state, reason: input.reason, note: input.note });
    if (!check.ok) throw new Error(check.error);

    await transitionCase(
      db,
      item,
      "closed",
      actor,
      { type: "closed", note: input.note, data: { reason: input.reason } },
      {
        closed_at: new Date().toISOString(),
        closed_by: staff.id,
        closure_reason: input.reason,
        closure_note: input.note.trim(),
      }
    );

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "loop.case_closed",
      targetType: "result_case",
      targetId: item.id,
      details: { reason: input.reason },
    });
  });
}

export async function reopenCase(caseId: string, reason: string) {
  return attempt(async () => {
    const { staff, db, actor } = await requireLoopStaff();
    assertAllowed(canReopenCases(staff.role), "Only a doctor can reopen a case.");
    if (!reason.trim()) throw new Error("Give a reason for reopening.");

    const item = await loadCase(db, caseId, staff.clinic_id);
    if (item.state !== "closed") throw new Error("This case is not closed.");

    const backTo: CaseState = item.care_started_at
      ? "attended"
      : item.acknowledged_at
        ? "acknowledged"
        : item.notified_at
          ? "notified"
          : "triaged";

    await transitionCase(
      db,
      item,
      backTo,
      actor,
      { type: "reopened", note: reason },
      {
        closed_at: null,
        closed_by: null,
        closure_reason: null,
        closure_note: null,
        reopened_count: item.reopened_count + 1,
      }
    );

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "loop.case_reopened",
      targetType: "result_case",
      targetId: item.id,
    });
  });
}

export async function addCaseNote(caseId: string, note: string) {
  return attempt(async () => {
    const { db, staff, actor } = await requireLoopStaff();
    if (!note.trim()) throw new Error("The note is empty.");
    const item = await loadCase(db, caseId, staff.clinic_id);
    await recordCaseEvent(db, item, actor, { type: "note", note });
  });
}

// ---- Clinician thread on a referral (clinic side) ----

export async function addReferralNote(referralId: string, body: string) {
  return attempt(async () => {
    const { staff, db } = await requireLoopStaff();
    assertAllowed(canProgressCases(staff.role), "Only clinical staff can write to the receiving clinician.");
    const text = body.trim();
    if (!text) throw new Error("Write a note first.");
    if (text.length > 1000) throw new Error("Keep the note under 1,000 characters.");
    const { data: referral, error } = await db
      .from("referrals")
      .select("id, clinic_id, case_id")
      .eq("id", referralId)
      .eq("clinic_id", staff.clinic_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!referral) throw new Error("Referral not found.");
    const { data: clinic } = await db.from("clinics").select("name").eq("id", staff.clinic_id).single();
    const { error: insertError } = await db.from("referral_messages").insert({
      clinic_id: staff.clinic_id,
      referral_id: referral.id,
      author_side: "clinic",
      author_name: `${staff.full_name} · ${clinic?.name ?? "Clinic"}`,
      author_staff_id: staff.id,
      body: text,
    });
    if (insertError) throw new Error(insertError.message);
  });
}
