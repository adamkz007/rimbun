// Drafts a referral letter from the case and the patient's latest encounter.
// The doctor edits the draft before it is sent.

export type ReferralLetterInput = {
  clinic: { name: string; address: string | null; phone: string | null };
  doctor: { full_name: string; mmc_number: string | null };
  patient: {
    full_name: string;
    ic_number: string | null;
    mrn: string;
    date_of_birth: string | null;
    gender: string | null;
    phone: string | null;
    allergies: string[];
  };
  receiving: { facility: string; clinician: string | null; specialty: string | null };
  result: { testLabel: string; value: string; collectedOn: string | null; source: string | null };
  urgencyLabel: string;
  reason: string;
  diagnoses: string[];
  medications: string[];
  conditions: string[];
  vitals: string | null;
  today: string;
};

function ageFrom(dateOfBirth: string | null, today: string) {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  const now = new Date(today);
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function formatMmc(mmc: string | null) {
  if (!mmc) return "";
  return /^mmc/i.test(mmc.trim()) ? ` (${mmc.trim()})` : ` (MMC ${mmc.trim()})`;
}

function list(values: string[], empty: string) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

export function buildReferralLetter(input: ReferralLetterInput) {
  const age = ageFrom(input.patient.date_of_birth, input.today);
  const demographics = [
    age !== null ? `${age} years` : null,
    input.patient.gender,
    input.patient.ic_number ? `IC ${input.patient.ic_number}` : null,
    `MRN ${input.patient.mrn}`,
  ]
    .filter(Boolean)
    .join(", ");
  const to = [input.receiving.clinician, input.receiving.specialty, input.receiving.facility]
    .filter(Boolean)
    .join(", ");

  return [
    `Date: ${input.today}`,
    `To: ${to}`,
    `From: ${input.doctor.full_name}${formatMmc(input.doctor.mmc_number)}, ${input.clinic.name}`,
    "",
    `Re: ${input.patient.full_name} (${demographics})`,
    `Urgency: ${input.urgencyLabel}`,
    "",
    "Dear colleague,",
    "",
    `Thank you for seeing this patient. ${input.reason}`.trim(),
    "",
    "Screening result:",
    `- ${input.result.testLabel}: ${input.result.value}${input.result.collectedOn ? ` (collected ${input.result.collectedOn})` : ""}${input.result.source ? `, ${input.result.source}` : ""}`,
    "",
    "Diagnoses from the latest consultation:",
    list(input.diagnoses, "None recorded"),
    "",
    "Known conditions:",
    list(input.conditions, "None recorded"),
    "",
    "Current medications:",
    list(input.medications, "None recorded"),
    "",
    `Allergies: ${input.patient.allergies.length ? input.patient.allergies.join(", ") : "No known allergies"}`,
    input.vitals ? `Latest vitals: ${input.vitals}` : null,
    "",
    "Please accept or decline this referral using the secure link, and send the outcome back so we can close the loop with the patient.",
    "",
    "Kind regards,",
    input.doctor.full_name,
    input.clinic.name,
    [input.clinic.address, input.clinic.phone].filter(Boolean).join(" · "),
  ]
    .filter((line) => line !== null)
    .join("\n");
}
