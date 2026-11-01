"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToPatientLink, verifyPatientLink } from "@/lib/actions/public-loop-actions";
import type { PatientLanguage } from "@/lib/care-loop/catalogue";
import { PublicCard } from "./public-shell";

const VERIFY_COPY = {
  en: {
    title: "Please confirm it's you",
    dob: "Enter your date of birth (DD/MM/YYYY)",
    ic: "Enter the last 4 characters of your IC number",
    none: "We can't verify this link online. Please call the clinic for your result.",
    button: "Show my result",
    privacy: "We ask this to keep your health information private.",
  },
  ms: {
    title: "Sila sahkan identiti anda",
    dob: "Masukkan tarikh lahir anda (HH/BB/TTTT)",
    ic: "Masukkan 4 aksara terakhir nombor IC anda",
    none: "Kami tidak dapat mengesahkan pautan ini dalam talian. Sila hubungi klinik untuk keputusan anda.",
    button: "Tunjukkan keputusan saya",
    privacy: "Kami bertanya untuk memastikan maklumat kesihatan anda kekal sulit.",
  },
};

const RESPONSE_COPY = {
  en: {
    title: "Let us know you've read this",
    question: "To check we explained it well: what happens next for you?",
    understood: "I understand",
    hasQuestion: "I have a question",
    callMe: "Please call me",
    pickAnswer: "Choose an answer above first.",
    thanks: "Thank you. Your clinic can see you've read your result.",
    callback: "Thank you. Someone from the clinic will call you within the hour during opening hours.",
  },
  ms: {
    title: "Beritahu kami anda telah membaca ini",
    question: "Untuk memastikan kami menerangkan dengan baik: apakah langkah seterusnya untuk anda?",
    understood: "Saya faham",
    hasQuestion: "Saya ada soalan",
    callMe: "Sila hubungi saya",
    pickAnswer: "Sila pilih jawapan di atas dahulu.",
    thanks: "Terima kasih. Klinik anda boleh melihat anda telah membaca keputusan anda.",
    callback: "Terima kasih. Kakitangan klinik akan menghubungi anda dalam masa sejam semasa waktu operasi.",
  },
};

export function PatientVerifyForm({
  token,
  language,
  prompt,
  clinicPhone,
}: {
  token: string;
  language: PatientLanguage;
  prompt: "dob" | "ic" | null;
  clinicPhone: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = VERIFY_COPY[language];

  if (!prompt) {
    return (
      <PublicCard>
        <p className="text-sm">{copy.none}</p>
        {clinicPhone ? <p className="mt-2 text-sm font-medium">{clinicPhone}</p> : null}
      </PublicCard>
    );
  }

  return (
    <PublicCard>
      <h1 className="text-lg font-semibold">{copy.title}</h1>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await verifyPatientLink(token, answer, language);
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        <label className="block text-sm" htmlFor="verify-answer">
          {prompt === "dob" ? copy.dob : copy.ic}
        </label>
        <input
          id="verify-answer"
          className="h-11 w-full rounded-lg border border-[#d8cfc3] bg-white px-3 text-base"
          inputMode={prompt === "dob" ? "numeric" : "text"}
          autoComplete={prompt === "dob" ? "bday" : "off"}
          placeholder={prompt === "dob" ? "31/12/1975" : "1234"}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
        {error ? (
          <p className="text-sm text-[#a11d1d]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isPending || !answer.trim()}
          className="h-11 w-full rounded-lg bg-[#083a39] text-sm font-medium text-white disabled:opacity-50"
        >
          {copy.button}
        </button>
        <p className="text-xs text-[#5f7a76]">{copy.privacy}</p>
      </form>
    </PublicCard>
  );
}

export function PatientResponse({
  token,
  language,
  alreadyAnswered,
  lastResponse,
  options,
}: {
  token: string;
  language: PatientLanguage;
  alreadyAnswered: boolean;
  lastResponse: string | null;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<string | null>(null);
  const [done, setDone] = useState<"understood" | "callback" | null>(
    alreadyAnswered ? "understood" : lastResponse === "call_me" || lastResponse === "question" ? "callback" : null
  );
  const [error, setError] = useState<string | null>(null);
  const copy = RESPONSE_COPY[language];

  function respond(response: "understood" | "question" | "call_me") {
    if (response === "understood" && !choice) {
      setError(copy.pickAnswer);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await respondToPatientLink(token, { response, teachBack: choice, language });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(response === "understood" ? "understood" : "callback");
      router.refresh();
    });
  }

  if (done === "understood") {
    return (
      <PublicCard>
        <p className="text-sm">{copy.thanks}</p>
      </PublicCard>
    );
  }

  return (
    <PublicCard>
      <h2 className="text-base font-semibold">{copy.title}</h2>
      {done === "callback" ? <p className="mt-2 text-sm text-[#0f5a53]">{copy.callback}</p> : null}
      <fieldset className="mt-3 space-y-2">
        <legend className="mb-2 text-sm">{copy.question}</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e3dbd0] p-3 text-sm has-checked:border-[#083a39] has-checked:bg-[#eef8f5]"
          >
            <input
              type="radio"
              name="teach-back"
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="mt-0.5"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {error ? (
        <p className="mt-3 text-sm text-[#a11d1d]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => respond("understood")}
          className="h-11 rounded-lg bg-[#083a39] text-sm font-medium text-white disabled:opacity-50"
        >
          {copy.understood}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => respond("question")}
            className="h-11 rounded-lg border border-[#d8cfc3] bg-white text-sm font-medium disabled:opacity-50"
          >
            {copy.hasQuestion}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => respond("call_me")}
            className="h-11 rounded-lg border border-[#d8cfc3] bg-white text-sm font-medium disabled:opacity-50"
          >
            {copy.callMe}
          </button>
        </div>
      </div>
    </PublicCard>
  );
}
