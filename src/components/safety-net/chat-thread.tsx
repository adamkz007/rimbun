import { cn } from "@/lib/utils";
import { formatClinicDateTime } from "@/lib/care-loop/format";

export type ThreadMessage = {
  id: string;
  direction: "out" | "in";
  kind: "template" | "question" | "text" | "button_reply";
  body: string;
  question_id: string | null;
  options: Array<{ value: string; label: string }> | null;
  created_at: string;
};

/**
 * The check-in conversation. Clinic messages sit on the left, the patient's on
 * the right. Buttons render under the message that asked; `renderOptions`
 * decides whether they can be tapped (only on the simulated phone).
 */
export function ChatThread({
  messages,
  renderOptions,
  tone = "staff",
}: {
  messages: ThreadMessage[];
  renderOptions?: (message: ThreadMessage) => React.ReactNode;
  tone?: "staff" | "phone";
}) {
  if (messages.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {messages.map((message) => {
        const outgoing = message.direction === "out";
        return (
          <li key={message.id} className={cn("flex flex-col", outgoing ? "items-start" : "items-end")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm shadow-sm",
                outgoing
                  ? tone === "phone"
                    ? "rounded-tl-sm bg-white text-[#143632]"
                    : "rounded-tl-sm border bg-card"
                  : tone === "phone"
                    ? "rounded-tr-sm bg-[#d4f0dc] text-[#143632]"
                    : "rounded-tr-sm bg-primary/10"
              )}
            >
              {message.kind === "template" ? (
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  Check-in (template)
                </span>
              ) : null}
              {message.body}
              <span className="mt-1 block text-right text-[10px] opacity-50">{formatClinicDateTime(message.created_at)}</span>
            </div>
            {outgoing && message.options?.length ? (
              renderOptions ? (
                renderOptions(message)
              ) : (
                <div className="mt-1 flex max-w-[85%] flex-wrap gap-1">
                  {message.options.map((option) => (
                    <span key={option.value} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {option.label}
                    </span>
                  ))}
                </div>
              )
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
