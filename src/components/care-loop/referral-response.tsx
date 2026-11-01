"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToReferral } from "@/lib/actions/public-loop-actions";
import { PublicCard } from "./public-shell";

type Mode = "accept" | "decline" | "outcome";

const INPUT = "h-11 w-full rounded-lg border border-[#d8cfc3] bg-white px-3 text-sm";

export function ReferralResponseForm({
  token,
  accepted,
  defaultName,
}: {
  token: string;
  accepted: boolean;
  defaultName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(accepted ? "outcome" : "accept");
  const [name, setName] = useState(defaultName);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const modes: Array<{ value: Mode; label: string }> = accepted
    ? [{ value: "outcome", label: "Return outcome" }]
    : [
        { value: "accept", label: "Accept" },
        { value: "decline", label: "Decline" },
        { value: "outcome", label: "Already seen" },
      ];

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await respondToReferral(token, {
        responderName: name,
        status: mode === "accept" ? "accepted" : mode === "decline" ? "rejected" : "attended",
        appointmentOn: mode === "accept" ? date : null,
        attendedOn: mode === "outcome" ? date : null,
        rejectReason: mode === "decline" ? text : null,
        outcomeNote: mode === "outcome" ? text : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  if (saved) {
    return (
      <PublicCard>
        <p className="text-sm">Thank you. The referring clinic has been updated.</p>
      </PublicCard>
    );
  }

  return (
    <PublicCard>
      <h2 className="text-base font-semibold">Your response</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {modes.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === option.value ? "border-[#083a39] bg-[#083a39] text-white" : "border-[#d8cfc3] bg-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1 text-sm">
          <span>Your name</span>
          <input className={INPUT} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {mode !== "decline" ? (
          <label className="block space-y-1 text-sm">
            <span>{mode === "accept" ? "Appointment date (optional)" : "Date seen"}</span>
            <input type="date" className={INPUT} value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        ) : null}
        {mode !== "accept" ? (
          <label className="block space-y-1 text-sm">
            <span>{mode === "decline" ? "Reason, and where the patient should go instead" : "Outcome and plan"}</span>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-[#d8cfc3] bg-white p-3 text-sm"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
        ) : null}
        {error ? (
          <p className="text-sm text-[#a11d1d]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="h-11 w-full rounded-lg bg-[#083a39] text-sm font-medium text-white disabled:opacity-50"
        >
          Send to referring clinic
        </button>
      </div>
    </PublicCard>
  );
}
