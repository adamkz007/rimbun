"use server";

import { randomBytes } from "node:crypto";
import { differenceInYears } from "date-fns";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import { PATIENT_LANGUAGES, type PatientLanguage } from "@/lib/care-loop/catalogue";
import { attempt } from "@/lib/care-loop/result";
import type { Actor, Db } from "@/lib/care-loop/server";
import { buildQuestionIds, getProtocol, validSigns } from "@/lib/safety-net/protocols";
import {
  loadFollowup,
  persistOutcome,
  processDueFollowups,
  recordFollowupEvent,
  runTimers,
  type FollowupRecord,
} from "@/lib/safety-net/server";
import {
  MAX_CHECKIN_HOURS,
  MIN_CHECKIN_HOURS,
  richTextToPlain,
  signSuggestion,
  suggestFollowUp,
  SUGGEST_MODEL,
  verifySuggestion,
  type Suggestion,
  type VisitSummary,
} from "@/lib/safety-net/suggest";
import { isSimulatorEnabled } from "@/lib/safety-net/transport";
import {
  applyCallLog,
  canScheduleFollowups,
  canWorkFollowups,
  checkClosure,
  CLOSURE_REASONS,
  ESCALATION_DUE_MINUTES,
  type ClosureReason,
} from "@/lib/safety-net/workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function requireFollowupStaff() {
  const staff = await requireActionAccess({ roles: ["doctor", "nurse"], module: "loop" });
  const db: Db = await getSupabaseServerClient();
  return { staff, db, actor: { kind: "staff", staffId: staff.id } as Actor };
}

function assertAllowed(allowed: boolean, message: string) {
  if (!allowed) throw new Error(message);
}

function refresh(followupId?: string) {
  revalidatePath("/followups");
  if (followupId) revalidatePath(`/followups/${followupId}`);
  revalidatePath("/dashboard");
}

async function loadEncounterForFollowup(db: Db, encounterId: string, clinicId: string) {
  const { data, error } = await db
    .from("encounters")
    .select(
      "id, clinic_id, patient_id, status, patients(id, full_name, date_of_birth, gender, phone, preferred_language, messaging_consent_at), encounter_vitals(*), encounter_notes(section, content), encounter_diagnoses(icd10_code, icd10_description, diagnosis_type, sort_order)"
    )
    .eq("id", encounterId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== clinicId) throw new Error("Encounter not found.");
  return data as unknown as EncounterForFollowup;
}

type EncounterForFollowup = {
  id: string;
  clinic_id: string;
  patient_id: string;
  status: string;
  patients: {
    id: string;
    full_name: string;
    date_of_birth: string | null;
    gender: string | null;
    phone: string | null;
    preferred_language: PatientLanguage;
    messaging_consent_at: string | null;
  };
  encounter_vitals:
    | Array<Record<string, number | null>>
    | Record<string, number | null>
    | null;
  encounter_notes: Array<{ section: string; content: unknown }>;
  encounter_diagnoses: Array<{ icd10_code: string; icd10_description: string; diagnosis_type: string; sort_order: number }>;
};

function vitalsText(raw: EncounterForFollowup["encounter_vitals"]) {
  const vitals = Array.isArray(raw) ? raw[0] : raw;
  if (!vitals) return null;
  const parts = [
    vitals.temperature != null ? `temperature ${vitals.temperature} °C` : null,
    vitals.heart_rate != null ? `heart rate ${vitals.heart_rate}/min` : null,
    vitals.blood_pressure_systolic != null && vitals.blood_pressure_diastolic != null
      ? `BP ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic} mmHg`
      : null,
    vitals.respiratory_rate != null ? `respiratory rate ${vitals.respiratory_rate}/min` : null,
    vitals.spo2 != null ? `SpO2 ${vitals.spo2}%` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// ---- Suggestion (Claude) ----

export async function suggestSafetyNet(encounterId: string) {
  return attempt(async () => {
    const { staff, db } = await requireFollowupStaff();
    assertAllowed(canScheduleFollowups(staff.role), "Only a doctor can set up a follow-up.");
    const encounter = await loadEncounterForFollowup(db, encounterId, staff.clinic_id);
    const patient = encounter.patients;

    // De-identified: no name, IC, MRN or phone number leaves the clinic.
    const visit: VisitSummary = {
      ageYears: patient.date_of_birth ? differenceInYears(new Date(), new Date(patient.date_of_birth)) : null,
      sex: patient.gender,
      vitals: vitalsText(encounter.encounter_vitals),
      diagnoses: [...(encounter.encounter_diagnoses ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d) => ({ code: d.icd10_code, description: d.icd10_description, type: d.diagnosis_type })),
      notes: Object.fromEntries(
        (encounter.encounter_notes ?? []).map((note) => [note.section, richTextToPlain(note.content)])
      ),
    };

    const suggestion = await suggestFollowUp(visit);
    return { suggestion, signature: signSuggestion(encounterId, suggestion), model: SUGGEST_MODEL };
  });
}

// ---- Scheduling ----

export async function scheduleSafetyNet(input: {
  encounterId: string;
  protocolCode: string;
  checkInHours: number;
  signs: string[];
  language: PatientLanguage;
  note?: string | null;
  consentConfirmed: boolean;
  suggestion?: { value: Suggestion; signature: string } | null;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireFollowupStaff();
    assertAllowed(canScheduleFollowups(staff.role), "Only a doctor can set up a follow-up.");

    const protocol = getProtocol(input.protocolCode);
    if (!protocol) throw new Error("Choose a question set.");
    const hours = Math.round(Number(input.checkInHours));
    if (!Number.isFinite(hours) || hours < MIN_CHECKIN_HOURS || hours > MAX_CHECKIN_HOURS) {
      throw new Error(`Check-in time must be between ${MIN_CHECKIN_HOURS} and ${MAX_CHECKIN_HOURS} hours.`);
    }
    if (!PATIENT_LANGUAGES.includes(input.language)) throw new Error("Choose a language.");

    const encounter = await loadEncounterForFollowup(db, input.encounterId, staff.clinic_id);
    const patient = encounter.patients;
    if (!patient.phone) throw new Error("Add the patient's mobile number before setting up a WhatsApp check-in.");

    const now = new Date();
    if (!patient.messaging_consent_at) {
      if (!input.consentConfirmed) {
        throw new Error("Confirm the patient agreed to receive WhatsApp messages from the clinic.");
      }
      const { error } = await db
        .from("patients")
        .update({ messaging_consent_at: now.toISOString(), preferred_language: input.language })
        .eq("id", patient.id);
      if (error) throw new Error(error.message);
    }

    const signs = validSigns(protocol, input.signs);
    const aiSuggestion =
      input.suggestion && verifySuggestion(input.encounterId, input.suggestion.value, input.suggestion.signature)
        ? { model: SUGGEST_MODEL, ...input.suggestion.value }
        : null;
    const checkinDueAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

    const { data: created, error } = await db
      .from("safety_net_followups")
      .insert({
        clinic_id: staff.clinic_id,
        patient_id: patient.id,
        encounter_id: encounter.id,
        protocol_code: protocol.code,
        protocol_version: protocol.version,
        signs,
        question_ids: buildQuestionIds(protocol, signs),
        doctor_note: input.note?.trim() || null,
        language: input.language,
        state: "scheduled",
        owner_staff_id: staff.id,
        created_by: staff.id,
        checkin_due_at: checkinDueAt,
        current_step_due_at: checkinDueAt,
        ai_suggestion: aiSuggestion,
        sim_token: randomBytes(24).toString("base64url"),
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("This visit already has an open follow-up.");
      throw new Error(error.message);
    }

    const matchedSuggestion =
      aiSuggestion &&
      aiSuggestion.protocolCode === protocol.code &&
      aiSuggestion.checkInHours === hours &&
      [...aiSuggestion.signs].sort().join() === [...signs].sort().join();
    await recordFollowupEvent(db, created, actor, {
      type: "scheduled",
      note: input.note,
      data: {
        protocol: protocol.code,
        checkInHours: hours,
        signs,
        language: input.language,
        suggestion: aiSuggestion ? (matchedSuggestion ? "accepted" : "changed") : "none",
      },
    });

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "safety_net.scheduled",
      targetType: "safety_net_followup",
      targetId: created.id,
      details: { protocol: protocol.code, checkInHours: hours },
    });

    refresh(created.id);
    return { followupId: created.id as string };
  });
}

// ---- Working the follow-up ----

export async function logFollowupCall(input: {
  followupId: string;
  outcome: "reached" | "no_answer" | "wrong_number";
  note?: string | null;
}) {
  return attempt(async () => {
    const { staff, db, actor } = await requireFollowupStaff();
    assertAllowed(canWorkFollowups(staff.role), "Only clinical staff can log calls.");
    if (!["reached", "no_answer", "wrong_number"].includes(input.outcome)) throw new Error("Choose a call outcome.");
    const followup = await loadFollowup(db, input.followupId, staff.clinic_id);
    if (followup.state === "closed") throw new Error("This follow-up is closed.");

    const saved = await persistOutcome(
      db,
      followup,
      applyCallLog(followup, input.outcome, input.note?.trim() || null),
      actor
    );
    if (!saved) throw new Error("This follow-up just changed. Refresh and try again.");
    refresh(followup.id);
  });
}

export async function escalateFollowup(followupId: string, note: string) {
  return attempt(async () => {
    const { staff, db, actor } = await requireFollowupStaff();
    if (!note.trim()) throw new Error("Say why the doctor is needed.");
    const followup = await loadFollowup(db, followupId, staff.clinic_id);
    if (followup.state === "closed" || followup.state === "escalated") {
      throw new Error("This follow-up is already closed or with a doctor.");
    }
    const now = new Date();
    const saved = await persistOutcome(
      db,
      followup,
      {
        patch: {
          state: "escalated",
          escalated_at: now.toISOString(),
          current_step_due_at: new Date(now.getTime() + ESCALATION_DUE_MINUTES * 60 * 1000).toISOString(),
        },
        outbound: [],
        events: [{ type: "escalated_by_staff", note }],
      },
      actor
    );
    if (!saved) throw new Error("This follow-up just changed. Refresh and try again.");
    refresh(followup.id);
  });
}

export async function closeFollowup(input: { followupId: string; reason: ClosureReason; note: string }) {
  return attempt(async () => {
    const { staff, db, actor } = await requireFollowupStaff();
    if (!CLOSURE_REASONS.includes(input.reason)) throw new Error("Choose a closure reason.");
    const followup = await loadFollowup(db, input.followupId, staff.clinic_id);
    const check = checkClosure({
      role: staff.role,
      state: followup.state,
      route: followup.route,
      reason: input.reason,
      note: input.note,
    });
    if (!check.ok) throw new Error(check.error);

    const now = new Date().toISOString();
    const saved = await persistOutcome(
      db,
      followup,
      {
        patch: {
          state: "closed",
          current_step_due_at: null,
          closed_at: now,
          closed_by: staff.id,
          closure_reason: input.reason,
          closure_note: input.note.trim(),
        },
        outbound: [],
        events: [{ type: "closed", note: input.note, data: { reason: input.reason } }],
      },
      actor
    );
    if (!saved) throw new Error("This follow-up just changed. Refresh and try again.");

    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "safety_net.closed",
      targetType: "safety_net_followup",
      targetId: followup.id,
      details: { reason: input.reason },
    });
    refresh(followup.id);
  });
}

// ---- Scheduler and demo controls ----

/** Runs the scheduler for this clinic now (the cron route does the same for every clinic). */
export async function runDueFollowups() {
  return attempt(async () => {
    const { staff, db } = await requireFollowupStaff();
    const result = await processDueFollowups(db, { clinicId: staff.clinic_id });
    refresh();
    return result;
  });
}

function assertDemoControls() {
  if (!isSimulatorEnabled()) throw new Error("Demo controls are only available in the prototype.");
}

/** Demo: send the check-in now instead of waiting for its time. */
export async function sendCheckInNow(followupId: string) {
  return attempt(async () => {
    assertDemoControls();
    const { staff, db } = await requireFollowupStaff();
    const followup = await loadFollowup(db, followupId, staff.clinic_id);
    if (followup.state !== "scheduled") throw new Error("This check-in has already been sent.");
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("safety_net_followups")
      .update({ checkin_due_at: now, current_step_due_at: now, updated_at: now })
      .eq("id", followup.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await runTimers(db, data as FollowupRecord);
    refresh(followup.id);
  });
}

/** Demo: move this follow-up's clock forward, then run its timers. */
export async function fastForwardFollowup(followupId: string, hours: number) {
  return attempt(async () => {
    assertDemoControls();
    const { staff, db } = await requireFollowupStaff();
    if (!Number.isFinite(hours) || hours <= 0 || hours > 72) throw new Error("Choose between 1 and 72 hours.");
    const followup = await loadFollowup(db, followupId, staff.clinic_id);
    const shift = (value: string | null) =>
      value ? new Date(new Date(value).getTime() - hours * 60 * 60 * 1000).toISOString() : null;
    const { data, error } = await db
      .from("safety_net_followups")
      .update({
        checkin_due_at: shift(followup.checkin_due_at)!,
        current_step_due_at: shift(followup.current_step_due_at),
        sent_at: shift(followup.sent_at),
        updated_at: new Date().toISOString(),
      })
      .eq("id", followup.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const moved = data as FollowupRecord;
    await recordFollowupEvent(db, moved, { kind: "staff", staffId: staff.id }, {
      type: "demo_fast_forward",
      data: { hours },
    });
    await runTimers(db, (await loadFollowup(db, moved.id)) as FollowupRecord);
    refresh(followup.id);
  });
}
