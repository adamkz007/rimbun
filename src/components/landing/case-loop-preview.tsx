import { Check, MessageCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Static marketing replica of a Care Loop case page. Step names mirror
// CASE_STATE_LABELS so the preview matches the real product.
const steps = [
  { label: "Result logged", detail: "HbA1c 8.1% · flagged Soon", when: "Day 0, 9:12 am" },
  { label: "Triaged", detail: "Dr. Hakim · next step: clinic review", when: "Day 0, 10:05 am" },
  { label: "Notified", detail: "WhatsApp secure link · Bahasa Melayu", when: "Day 0, 1:20 pm" },
  { label: "Acknowledged", detail: "Patient picked the correct next step", when: "Day 0, 4:48 pm" },
  { label: "Attended", detail: "Review done · metformin started", when: "Day 7" },
  { label: "Closed", detail: "Evidence attached · HbA1c recheck in 3 months", when: "Day 8", final: true },
];

export function CaseLoopPreview() {
  return (
    <figure className="relative min-w-0 lg:w-[40rem]">
      <div className="overflow-hidden rounded-[1.25rem] border border-leaf-ink/10 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_64px_-12px] shadow-leaf-ink/25 ring-8 ring-white/60">
        {/* Case header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-leaf-rule px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-sage/45 text-xs font-semibold text-leaf-ink">
            SA
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-leaf-text">Siti Aminah binti Yusof</p>
            <p className="truncate text-[11px] text-leaf-muted">HbA1c 8.1% · new diabetes range</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-leaf px-2.5 py-1 text-[11px] font-medium text-white">
            <Check className="size-3" aria-hidden="true" />
            Loop closed
          </span>
        </div>

        <div className="flex items-center gap-2 border-b border-leaf-rule bg-leaf-paper/60 px-5 py-2.5 text-[11px] text-leaf-muted">
          <UserRound className="size-3.5" aria-hidden="true" />
          Owner <span className="font-medium text-leaf-text">Siti Nur (nurse)</span>
          <span aria-hidden="true">·</span>
          every step due on time
        </div>

        {/* Timeline */}
        <ol className="space-y-0 px-5 pt-4 pb-4 sm:pb-12" aria-hidden="true">
          {steps.map((step, index) => (
            <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
              {index < steps.length - 1 ? (
                <span className="absolute top-6 bottom-0 left-[11px] w-px bg-leaf-rule" />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
                  step.final ? "bg-leaf-ink text-leaf-paper" : "bg-leaf-mist text-leaf"
                )}
              >
                <Check className="size-3.5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-leaf-text">{step.label}</p>
                  <p className="text-xs text-leaf-muted">{step.detail}</p>
                </div>
                <p className="text-[11px] whitespace-nowrap text-leaf-muted tabular-nums">{step.when}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Floating patient confirmation */}
      <div
        className="absolute -bottom-6 left-4 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/85 py-2.5 pr-4 pl-2.5 shadow-xl shadow-leaf-ink/12 backdrop-blur-md sm:flex lg:-left-8"
        aria-hidden="true"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-leaf text-white">
          <MessageCircle className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-leaf-text">&ldquo;Saya faham&rdquo;</p>
          <p className="text-[11px] text-leaf-muted">Patient confirmed via secure link</p>
        </div>
      </div>

      <figcaption className="sr-only">
        Example Care Loop case: an HbA1c result moves from logged to triaged, patient notified by WhatsApp,
        acknowledged, reviewed, and closed with evidence, with one owner throughout.
      </figcaption>
    </figure>
  );
}
