import { createHmac, timingSafeEqual } from "node:crypto";
import type { Tables } from "@/types/database";
import { getServiceDb, recordCaseEvent, type CaseRecord } from "./server";
import { hashLinkToken, isLinkExpired, isWellFormedToken } from "./tokens";

// Lookups behind the public patient (/r/[token]) and specialist
// (/referral/[token]) pages. They run with the service role, so every query
// is keyed by the hashed token and nothing else.

export type PatientLinkData = {
  message: Tables<"patient_messages">;
  item: CaseRecord;
  patient: Pick<
    Tables<"patients">,
    "id" | "full_name" | "date_of_birth" | "ic_number" | "preferred_language"
  >;
  result: Pick<Tables<"screening_results">, "test_code" | "value_numeric" | "value_text" | "collected_on">;
  clinic: { name: string; phone: string | null; address: string | null };
};

export type LinkLookup<T> = { status: "ok"; data: T } | { status: "expired" } | { status: "invalid" };

export async function loadPatientLink(token: string): Promise<LinkLookup<PatientLinkData>> {
  if (!isWellFormedToken(token)) return { status: "invalid" };
  const db = getServiceDb();

  const { data: message } = await db
    .from("patient_messages")
    .select("*")
    .eq("token_hash", hashLinkToken(token))
    .maybeSingle();
  if (!message) return { status: "invalid" };
  if (!message.expires_at || isLinkExpired(message.expires_at)) return { status: "expired" };

  const { data: item } = await db.from("result_cases").select("*").eq("id", message.case_id).single();
  if (!item) return { status: "invalid" };

  const [{ data: patient }, { data: result }, { data: clinic }] = await Promise.all([
    db
      .from("patients")
      .select("id, full_name, date_of_birth, ic_number, preferred_language")
      .eq("id", item.patient_id)
      .single(),
    db
      .from("screening_results")
      .select("test_code, value_numeric, value_text, collected_on")
      .eq("id", item.result_id)
      .single(),
    db.from("clinics").select("name, phone, address").eq("id", item.clinic_id).single(),
  ]);
  if (!patient || !result || !clinic) return { status: "invalid" };

  return { status: "ok", data: { message, item, patient, result, clinic } };
}

export type ReferralLinkData = {
  referral: Tables<"referrals">;
  item: CaseRecord;
  patientName: string;
  clinic: { name: string; phone: string | null; address: string | null };
};

export async function loadReferralLink(token: string): Promise<LinkLookup<ReferralLinkData>> {
  if (!isWellFormedToken(token)) return { status: "invalid" };
  const db = getServiceDb();

  const { data: referral } = await db
    .from("referrals")
    .select("*")
    .eq("token_hash", hashLinkToken(token))
    .maybeSingle();
  if (!referral) return { status: "invalid" };
  if (isLinkExpired(referral.expires_at)) return { status: "expired" };

  const { data: item } = await db.from("result_cases").select("*").eq("id", referral.case_id).single();
  if (!item) return { status: "invalid" };

  const [{ data: patient }, { data: clinic }] = await Promise.all([
    db.from("patients").select("full_name").eq("id", item.patient_id).single(),
    db.from("clinics").select("name, phone, address").eq("id", item.clinic_id).single(),
  ]);
  if (!patient || !clinic) return { status: "invalid" };

  return { status: "ok", data: { referral, item, patientName: patient.full_name, clinic } };
}

// ---- Patient verification cookie ----

function linkSecret() {
  const secret = process.env.LOOP_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing LOOP_LINK_SECRET.");
  return secret;
}

export function verificationCookieName(token: string) {
  return `rl_${hashLinkToken(token).slice(0, 16)}`;
}

export function verificationCookieValue(token: string) {
  return createHmac("sha256", linkSecret()).update(hashLinkToken(token)).digest("base64url");
}

export function isVerificationCookieValid(token: string, value: string | undefined) {
  if (!value) return false;
  const expected = Buffer.from(verificationCookieValue(token));
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---- First-view tracking (called while rendering the public pages) ----

export async function markPatientLinkOpened(data: PatientLinkData) {
  if (data.message.opened_at) return;
  const db = getServiceDb();
  await db
    .from("patient_messages")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", data.message.id)
    .is("opened_at", null);
  await recordCaseEvent(db, data.item, { kind: "external", label: "Patient (secure link)" }, {
    type: "link_opened",
  });
}

export async function markReferralViewed(data: ReferralLinkData) {
  if (data.referral.viewed_at) return;
  const db = getServiceDb();
  const update: Record<string, string> = { viewed_at: new Date().toISOString() };
  if (data.referral.status === "sent") update.status = "viewed";
  await db.from("referrals").update(update).eq("id", data.referral.id).is("viewed_at", null);
  await recordCaseEvent(
    db,
    data.item,
    { kind: "external", label: data.referral.receiving_facility },
    { type: "referral_viewed", data: { referralId: data.referral.id } }
  );
}
