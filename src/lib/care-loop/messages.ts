import { NEXT_STEP_LABELS, type NextStep, type PatientLanguage } from "./catalogue.ts";

// Outbound patient messages carry no result values or test names: the details
// sit behind the secure link, which asks for the patient's date of birth.

export type MessageKind = "result_notice" | "reminder";

export const LANGUAGE_LABELS: Record<PatientLanguage, string> = {
  en: "English",
  ms: "Bahasa Melayu",
};

export function buildPatientMessage(input: {
  kind: MessageKind;
  language: PatientLanguage;
  patientFirstName: string;
  clinicName: string;
  link: string;
}) {
  const { patientFirstName: name, clinicName: clinic, link } = input;

  if (input.language === "ms") {
    return input.kind === "reminder"
      ? `Salam ${name}, ini peringatan daripada ${clinic}. Anda mempunyai keputusan ujian yang memerlukan tindakan susulan. Sila buka pautan selamat ini dan sahkan anda telah membacanya: ${link}`
      : `Salam ${name}, ${clinic} mempunyai keputusan ujian untuk anda yang memerlukan tindakan susulan. Sila buka pautan selamat ini untuk melihat maksudnya dan langkah seterusnya: ${link}`;
  }

  return input.kind === "reminder"
    ? `Hello ${name}, a reminder from ${clinic}. You have a test result that needs follow-up. Please open this secure link and let us know you've read it: ${link}`
    : `Hello ${name}, ${clinic} has a test result for you that needs follow-up. Please open this secure link to see what it means and what to do next: ${link}`;
}

/**
 * Normalises a Malaysian phone number to international digits for wa.me and
 * sms: links ("012-345 6789" → "60123456789"). Returns null when the number
 * cannot be used.
 */
export function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  digits = digits.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

export function buildWhatsAppLink(phone: string | null | undefined, text: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export function buildSmsLink(phone: string | null | undefined, text: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `sms:+${normalized}?body=${encodeURIComponent(text)}`;
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Accepts the patient's date of birth as typed (DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD). */
export function parseDateOfBirthInput(input: string) {
  const value = input.trim();
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return toIsoDate(match[1], match[2], match[3]);
  match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) return toIsoDate(match[3], match[2], match[1]);
  return null;
}

function toIsoDate(year: string, month: string, day: string) {
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * The patient proves who they are with their date of birth, or the last four
 * characters of their IC number when no date of birth is on file.
 */
export function verifyPatientIdentity(
  patient: { date_of_birth: string | null; ic_number: string | null },
  input: string
) {
  if (patient.date_of_birth) {
    return parseDateOfBirthInput(input) === patient.date_of_birth.slice(0, 10);
  }

  const ic = patient.ic_number?.replace(/\W/g, "");
  if (ic && ic.length >= 4) {
    return input.replace(/\W/g, "").toUpperCase() === ic.slice(-4).toUpperCase();
  }

  return false;
}

export function identityPrompt(patient: { date_of_birth: string | null; ic_number: string | null }) {
  if (patient.date_of_birth) return "dob" as const;
  if (patient.ic_number && patient.ic_number.replace(/\W/g, "").length >= 4) return "ic" as const;
  return null;
}

// ---- Patient page helpers ----

const NOTHING_TO_DO: Record<PatientLanguage, string> = {
  en: "Nothing, the result is normal",
  ms: "Tiada apa-apa, keputusan adalah normal",
};

/**
 * Teach-back check: the patient picks what happens next. The correct answer is
 * the case's next step; the order is fixed per step so a reload doesn't
 * reshuffle it.
 */
export function teachBackOptions(
  nextStep: NextStep,
  language: PatientLanguage
): Array<{ value: string; label: string; correct: boolean }> {
  const distractor: NextStep = nextStep === "referral" ? "repeat_test" : "referral";
  const options = [
    { value: nextStep, label: NEXT_STEP_LABELS[nextStep][language], correct: true },
    { value: "nothing", label: NOTHING_TO_DO[language], correct: false },
    { value: distractor, label: NEXT_STEP_LABELS[distractor][language], correct: false },
  ];
  const rotate = ["clinic_review", "repeat_test", "referral", "same_day_review"].indexOf(nextStep) % 3;
  return [...options.slice(rotate), ...options.slice(0, rotate)];
}

export type TrackerStep = { key: string; label: Record<PatientLanguage, string>; done: boolean; current: boolean };

/** The patient-facing journey: fewer, plainer steps than the staff timeline. */
export function patientTracker(state: string, nextStep: NextStep): TrackerStep[] {
  const order = ["triaged", "notified", "acknowledged", "confirmed", "referred", "accepted", "attended", "in_care", "closed"];
  const at = order.indexOf(state);
  const steps: Array<{ key: string; label: Record<PatientLanguage, string>; reachedAt: number }> = [
    { key: "ready", label: { en: "Result ready", ms: "Keputusan sedia" }, reachedAt: 0 },
    { key: "read", label: { en: "You've read it", ms: "Anda telah membacanya" }, reachedAt: order.indexOf("acknowledged") },
    {
      key: "next",
      label:
        nextStep === "referral"
          ? { en: "Specialist appointment", ms: "Temujanji pakar" }
          : { en: "Clinic follow-up", ms: "Susulan klinik" },
      reachedAt: order.indexOf("attended"),
    },
    { key: "care", label: { en: "Care plan in place", ms: "Pelan rawatan disediakan" }, reachedAt: order.indexOf("in_care") },
  ];
  const firstOpen = steps.findIndex((step) => at < step.reachedAt);
  return steps.map((step, index) => ({
    key: step.key,
    label: step.label,
    done: at >= step.reachedAt,
    current: index === firstOpen,
  }));
}
