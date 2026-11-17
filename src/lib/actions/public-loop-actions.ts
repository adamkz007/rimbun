"use server";

import { cookies } from "next/headers";
import { teachBackOptions, verifyPatientIdentity } from "@/lib/care-loop/messages";
import {
  isVerificationCookieValid,
  loadPatientLink,
  loadReferralLink,
  verificationCookieName,
  verificationCookieValue,
} from "@/lib/care-loop/public-links";
import { applyReferralUpdate, type ReferralUpdate } from "@/lib/care-loop/referral-updates";
import { getServiceDb, transitionCase, updateCase, type Actor } from "@/lib/care-loop/server";
import { hashLinkToken } from "@/lib/care-loop/tokens";
import type { NextStep, PatientLanguage } from "@/lib/care-loop/catalogue";

// Actions behind the public secure links. They never trust anything but the
// link token, and patient answers also need the verification cookie.

type ActionResult = { ok: true } | { ok: false; error: string };

const ERRORS = {
  invalid: { en: "This link is no longer valid.", ms: "Pautan ini tidak lagi sah." },
  retry: { en: "Please try again in a moment.", ms: "Sila cuba lagi sebentar lagi." },
  tooMany: {
    en: "Too many attempts. Please try again in 15 minutes.",
    ms: "Terlalu banyak cubaan. Sila cuba lagi dalam 15 minit.",
  },
  mismatch: {
    en: "That doesn't match our records. Please check and try again.",
    ms: "Maklumat itu tidak sepadan dengan rekod kami. Sila semak dan cuba lagi.",
  },
  reverify: { en: "Please confirm your details again.", ms: "Sila sahkan maklumat anda sekali lagi." },
  failed: { en: "Something went wrong. Please try again.", ms: "Berlaku ralat. Sila cuba lagi." },
} satisfies Record<string, Record<PatientLanguage, string>>;

const PATIENT: Actor = { kind: "external", label: "Patient (secure link)" };
const VERIFY_LIMIT = 5;
const VERIFY_WINDOW_SECONDS = 15 * 60;

export async function verifyPatientLink(
  token: string,
  answer: string,
  language: PatientLanguage = "en"
): Promise<ActionResult> {
  const lang = language === "ms" ? "ms" : "en";
  const lookup = await loadPatientLink(token);
  if (lookup.status !== "ok") return { ok: false, error: ERRORS.invalid[lang] };

  const db = getServiceDb();
  const { data: allowed, error } = await db.rpc("consume_diagnose_quota", {
    p_bucket: `loop-verify:${hashLinkToken(token).slice(0, 32)}`,
    p_limit: VERIFY_LIMIT,
    p_window_seconds: VERIFY_WINDOW_SECONDS,
  });
  if (error) return { ok: false, error: ERRORS.retry[lang] };
  if (!allowed) return { ok: false, error: ERRORS.tooMany[lang] };

  if (!verifyPatientIdentity(lookup.data.patient, answer)) {
    return { ok: false, error: ERRORS.mismatch[lang] };
  }

  const cookieStore = await cookies();
  cookieStore.set(verificationCookieName(token), verificationCookieValue(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/r/${token}`,
    maxAge: 60 * 60 * 24,
  });

  if (!lookup.data.message.verified_at) {
    await db
      .from("patient_messages")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", lookup.data.message.id);
  }

  return { ok: true };
}

export async function respondToPatientLink(
  token: string,
  input: { response: "understood" | "question" | "call_me"; teachBack?: string | null; language: PatientLanguage }
): Promise<ActionResult> {
  const lang = input.language === "ms" ? "ms" : "en";
  const lookup = await loadPatientLink(token);
  if (lookup.status !== "ok") return { ok: false, error: ERRORS.invalid[lang] };

  const cookieStore = await cookies();
  if (!isVerificationCookieValid(token, cookieStore.get(verificationCookieName(token))?.value)) {
    return { ok: false, error: ERRORS.reverify[lang] };
  }

  const { message, item } = lookup.data;
  if (item.state === "closed") return { ok: true };

  const db = getServiceDb();
  const now = new Date().toISOString();
  const correct =
    input.response === "understood"
      ? teachBackOptions(item.next_step as NextStep, input.language).find(
          (option) => option.value === input.teachBack
        )?.correct ?? false
      : null;

  const { error } = await db
    .from("patient_messages")
    .update({ response: input.response, responded_at: now, understanding_correct: correct })
    .eq("id", message.id);
  if (error) return { ok: false, error: ERRORS.failed[lang] };

  try {
    if (input.response === "understood") {
      const event = { type: "patient_acknowledged", data: { understandingCorrect: correct, language: input.language } };
      if (item.state === "triaged" || item.state === "notified") {
        await transitionCase(db, item, "acknowledged", PATIENT, event, { understanding_correct: correct });
      } else {
        await updateCase(db, item, PATIENT, { understanding_correct: correct }, event);
      }
      return { ok: true };
    }

    // A question or a call-back request becomes a staff task due within the hour.
    const callbackDue = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const dueAt =
      item.current_step_due_at && item.current_step_due_at < callbackDue ? item.current_step_due_at : callbackDue;
    await updateCase(
      db,
      item,
      PATIENT,
      { current_step_due_at: dueAt },
      { type: input.response === "call_me" ? "callback_requested" : "patient_question" }
    );
  } catch {
    return { ok: false, error: ERRORS.failed[lang] };
  }
  return { ok: true };
}

export async function respondToReferral(
  token: string,
  input: ReferralUpdate & { responderName?: string | null; note?: string | null }
): Promise<ActionResult> {
  const lookup = await loadReferralLink(token);
  if (lookup.status !== "ok") return { ok: false, error: "This link is no longer valid." };

  const name = input.responderName?.trim() || lookup.data.referral.receiving_clinician || "Receiving clinician";
  const actor: Actor = { kind: "external", label: `${name} (${lookup.data.referral.receiving_facility})` };

  try {
    await applyReferralUpdate(getServiceDb(), lookup.data.referral, actor, input);
    if (input.note?.trim()) await insertReceiverNote(lookup.data.referral, name, input.note);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to save your response." };
  }
}

// ---- Clinician thread on a referral (receiver side) ----

const NOTE_MAX = 1000;

async function insertReceiverNote(
  referral: { id: string; clinic_id: string; receiving_facility: string },
  name: string,
  body: string
) {
  const text = body.trim().slice(0, NOTE_MAX);
  if (!text) return;
  const { error } = await getServiceDb()
    .from("referral_messages")
    .insert({
      clinic_id: referral.clinic_id,
      referral_id: referral.id,
      // Set here, never from the request: notes through the link are always the receiver's.
      author_side: "receiver",
      author_name: `${name.trim().slice(0, 80) || "Receiving clinician"} · ${referral.receiving_facility}`.slice(0, 160),
      body: text,
    });
  if (error) throw new Error("Unable to save your note.");
}

export async function postReferralNote(token: string, input: { name?: string | null; body: string }): Promise<ActionResult> {
  const lookup = await loadReferralLink(token);
  if (lookup.status !== "ok") return { ok: false, error: "This link is no longer valid." };
  if (!input.body?.trim()) return { ok: false, error: "Write a note first." };
  if (input.body.trim().length > NOTE_MAX) return { ok: false, error: "Keep the note under 1,000 characters." };
  try {
    const name = input.name?.trim() || lookup.data.referral.receiving_clinician || "Receiving clinician";
    await insertReceiverNote(lookup.data.referral, name, input.body);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to save your note." };
  }
}
