"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal } from "lucide-react";
import { simulatorReply } from "@/lib/actions/safety-net-sim-actions";
import { cn } from "@/lib/utils";
import { ChatThread, type ThreadMessage } from "./chat-thread";

/**
 * A stand-in for the patient's WhatsApp. Only the buttons on the latest
 * question can be tapped, as in a real chat; the server ignores stale taps anyway.
 */
export function SimulatedPhone({
  token,
  clinicName,
  messages,
  activeQuestionId,
}: {
  token: string;
  clinicName: string;
  messages: ThreadMessage[];
  activeQuestionId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // New clinic messages arrive when staff send the check-in or the scheduler runs.
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const latestAsk = [...messages].reverse().find((message) => message.direction === "out" && message.options?.length);

  function send(reply: Parameters<typeof simulatorReply>[1]) {
    setError(null);
    startTransition(async () => {
      const result = await simulatorReply(token, reply);
      if (!result.ok) setError(result.error);
      else if (reply.kind === "text") setText("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex h-[min(760px,calc(100dvh-2rem))] w-full max-w-[380px] flex-col overflow-hidden rounded-[2rem] border-[6px] border-neutral-800 bg-[#efe7dc] shadow-xl">
      <header className="flex items-center gap-3 bg-[#0b4d48] px-4 py-3 text-white">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
          {clinicName.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{clinicName}</span>
          <span className="block text-[11px] text-white/70">Simulated chat · prototype</span>
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4" aria-live="polite">
        <ChatThread
          tone="phone"
          messages={messages}
          renderOptions={(message) => {
            const live = message.id === latestAsk?.id && message.question_id === activeQuestionId;
            return (
              <div className="mt-1 grid w-[85%] gap-1">
                {message.options!.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!live || isPending}
                    onClick={() => send({ kind: "button", questionId: message.question_id!, value: option.value })}
                    className={cn(
                      "rounded-xl bg-white px-3 py-2 text-sm font-medium shadow-sm transition-colors",
                      live ? "text-[#0b6b63] hover:bg-[#f4fbf8]" : "text-neutral-400"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            );
          }}
        />
        <div ref={bottom} />
      </div>

      {error ? <p className="bg-red-50 px-3 py-1.5 text-xs text-red-800">{error}</p> : null}

      <form
        className="flex items-center gap-2 bg-[#f6f0e8] px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) send({ kind: "text", text });
        }}
      >
        <label htmlFor="sim-message" className="sr-only">
          Message
        </label>
        <input
          id="sim-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message"
          className="h-10 flex-1 rounded-full border-0 bg-white px-4 text-sm text-[#143632] outline-none ring-1 ring-black/5 focus:ring-[#0b6b63]"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="inline-flex size-10 items-center justify-center rounded-full bg-[#0b6b63] text-white disabled:opacity-50"
          aria-label="Send"
        >
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </div>
  );
}
