import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { formatClinicDate, formatClinicDateTime } from "@/lib/care-loop/format";
import { PatientResponse, PatientVerifyForm } from "@/components/care-loop/patient-link";
import { LinkProblem, PublicCard, PublicShell } from "@/components/care-loop/public-shell";
import {
  formatResultValue,
  getTest,
  NEXT_STEP_LABELS,
  PATIENT_LANGUAGES,
  type NextStep,
  type PatientLanguage,
  type Urgency,
} from "@/lib/care-loop/catalogue";
import { identityPrompt, LANGUAGE_LABELS, patientTracker, teachBackOptions } from "@/lib/care-loop/messages";
import {
  isVerificationCookieValid,
  loadPatientLink,
  markPatientLinkOpened,
  verificationCookieName,
} from "@/lib/care-loop/public-links";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your test result",
  robots: { index: false, follow: false },
};

const COPY = {
  en: {
    subtitle: "Your test result",
    hello: "Hello",
    checked: "This test checks",
    yourResult: "Your result",
    whatItMeans: "What it means",
    nextStep: "What to do next",
    howSoon: "How soon",
    appointment: "Your appointment",
    contact: "Questions? Call the clinic",
    journey: "Your journey",
    closed: "Your clinic has completed the follow-up for this result. Thank you.",
    emergency: "If you feel very unwell, go to the nearest emergency department or call 999.",
  },
  ms: {
    subtitle: "Keputusan ujian anda",
    hello: "Salam",
    checked: "Ujian ini memeriksa",
    yourResult: "Keputusan anda",
    whatItMeans: "Maksudnya",
    nextStep: "Langkah seterusnya",
    howSoon: "Bila",
    appointment: "Temujanji anda",
    contact: "Ada soalan? Hubungi klinik",
    journey: "Perjalanan anda",
    closed: "Klinik anda telah melengkapkan tindakan susulan untuk keputusan ini. Terima kasih.",
    emergency: "Jika anda berasa sangat tidak sihat, pergi ke jabatan kecemasan terdekat atau hubungi 999.",
  },
} as const;

const HOW_SOON: Record<Urgency, Record<PatientLanguage, string>> = {
  routine: { en: "Within the next few weeks", ms: "Dalam beberapa minggu akan datang" },
  soon: { en: "Within the next week", ms: "Dalam seminggu akan datang" },
  urgent: { en: "Within the next 1 to 2 days", ms: "Dalam 1 hingga 2 hari akan datang" },
  critical: { en: "Today", ms: "Hari ini" },
};

export default async function PatientResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const lookup = await loadPatientLink(token);
  if (lookup.status !== "ok") return <LinkProblem status={lookup.status} />;

  const { item, patient, result, clinic, message } = lookup.data;
  await markPatientLinkOpened(lookup.data);

  const requestedLang = Array.isArray(query.lang) ? query.lang[0] : query.lang;
  const language: PatientLanguage = PATIENT_LANGUAGES.includes(requestedLang as PatientLanguage)
    ? (requestedLang as PatientLanguage)
    : ((message.language as PatientLanguage) ?? patient.preferred_language);
  const copy = COPY[language];
  const cookieStore = await cookies();
  const verified = isVerificationCookieValid(token, cookieStore.get(verificationCookieName(token))?.value);
  const prompt = identityPrompt(patient);

  const languageSwitch = (
    <div className="mb-4 flex gap-2 text-xs">
      {PATIENT_LANGUAGES.map((value) => (
        <Link
          key={value}
          href={`?lang=${value}`}
          className={cn(
            "rounded-full border px-3 py-1",
            value === language ? "border-[#083a39] bg-[#083a39] text-white" : "border-[#d8cfc3] bg-white"
          )}
        >
          {LANGUAGE_LABELS[value]}
        </Link>
      ))}
    </div>
  );

  if (!verified) {
    return (
      <PublicShell clinicName={clinic.name} subtitle={copy.subtitle}>
        {languageSwitch}
        <PatientVerifyForm token={token} language={language} prompt={prompt} clinicPhone={clinic.phone} />
      </PublicShell>
    );
  }

  const test = getTest(item.test_code);
  const nextStep = item.next_step as NextStep;
  const tracker = patientTracker(item.state, nextStep);
  const alreadyAnswered = message.response === "understood" || !!item.acknowledged_at;

  return (
    <PublicShell clinicName={clinic.name} subtitle={copy.subtitle}>
      {languageSwitch}
      <div className="space-y-4">
        <PublicCard>
          <p className="text-sm text-[#5f7a76]">
            {copy.hello} {patient.full_name.split(" ")[0]},
          </p>
          <h1 className="mt-1 text-xl font-semibold">{test?.label ?? item.test_code}</h1>
          {test ? (
            <p className="mt-1 text-sm text-[#4b6662]">
              {copy.checked} {test.about[language]}.
            </p>
          ) : null}
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[#5f7a76]">{copy.yourResult}</dt>
              <dd className="font-medium">
                {formatResultValue(item.test_code, { numeric: result.value_numeric, text: result.value_text })}
                {result.collected_on ? ` · ${formatClinicDate(result.collected_on)}` : ""}
              </dd>
            </div>
            {test ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#5f7a76]">{copy.whatItMeans}</dt>
                <dd>{test.meaning[language]}</dd>
              </div>
            ) : null}
          </dl>
        </PublicCard>

        <PublicCard className="border-[#0f5a53]/40 bg-[#eef8f5]">
          <p className="text-xs uppercase tracking-wide text-[#0f5a53]">{copy.nextStep}</p>
          <p className="mt-1 text-lg font-semibold">{NEXT_STEP_LABELS[nextStep][language]}</p>
          <p className="mt-2 text-sm">
            <span className="text-[#5f7a76]">{copy.howSoon}: </span>
            {HOW_SOON[item.urgency as Urgency][language]}
          </p>
          {item.appointment_at ? (
            <p className="mt-1 text-sm">
              <span className="text-[#5f7a76]">{copy.appointment}: </span>
              {formatClinicDateTime(item.appointment_at)}
            </p>
          ) : null}
          {clinic.phone ? (
            <p className="mt-3 text-sm">
              {copy.contact}:{" "}
              <a href={`tel:${clinic.phone.replace(/\s/g, "")}`} className="font-medium underline">
                {clinic.phone}
              </a>
            </p>
          ) : null}
        </PublicCard>

        {item.state === "closed" ? (
          <PublicCard>
            <p className="text-sm">{copy.closed}</p>
          </PublicCard>
        ) : (
          <PatientResponse
            token={token}
            language={language}
            alreadyAnswered={alreadyAnswered}
            lastResponse={message.response}
            options={teachBackOptions(nextStep, language).map(({ value, label }) => ({ value, label }))}
          />
        )}

        <PublicCard>
          <p className="mb-3 text-xs uppercase tracking-wide text-[#5f7a76]">{copy.journey}</p>
          <ol className="space-y-2">
            {tracker.map((step) => (
              <li key={step.key} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full border text-[10px]",
                    step.done && "border-[#0f5a53] bg-[#0f5a53] text-white",
                    step.current && "border-[#0f5a53] text-[#0f5a53]"
                  )}
                >
                  {step.done ? "✓" : ""}
                </span>
                <span className={cn(!step.done && !step.current && "text-[#8aa09c]", step.current && "font-medium")}>
                  {step.label[language]}
                </span>
              </li>
            ))}
          </ol>
        </PublicCard>

        <p className="px-1 text-xs text-[#5f7a76]">{copy.emergency}</p>
      </div>
    </PublicShell>
  );
}
