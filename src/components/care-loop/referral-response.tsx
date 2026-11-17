"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postReferralNote, respondToReferral } from "@/lib/actions/public-loop-actions";
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
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
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
        appointmentTime: mode === "accept" ? time : null,
        appointmentPlace: mode === "accept" ? place : null,
        note,
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
        {mode === "accept" && date ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span>Time (optional)</span>
              <input type="time" className={INPUT} value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Where (optional)</span>
              <input className={INPUT} placeholder="e.g. ED triage" value={place} onChange={(event) => setPlace(event.target.value)} />
            </label>
          </div>
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
        <label className="block space-y-1 text-sm">
          <span>Note for the referring doctor (optional)</span>
          <textarea
            rows={2}
            maxLength={1000}
            className="w-full rounded-lg border border-[#d8cfc3] bg-white p-3 text-sm"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
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

/** A note to the referring clinic, at any point while the link is valid. */
export function ReferralNoteForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await postReferralNote(token, { name, body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[#e3dbd0] pt-3">
      <input className={INPUT} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
      <textarea
        rows={2}
        maxLength={1000}
        placeholder="Write to the referring doctor"
        className="w-full rounded-lg border border-[#d8cfc3] bg-white p-3 text-sm"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {error ? (
        <p className="text-sm text-[#a11d1d]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={isPending || !body.trim()}
        onClick={send}
        className="h-10 w-full rounded-lg border border-[#083a39] text-sm font-medium text-[#083a39] disabled:opacity-50"
      >
        Send note
      </button>
    </div>
  );
}
