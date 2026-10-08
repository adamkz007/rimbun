"use client";

import { AlertTriangle, Bot, Brain, Pill, Phone, Printer, RotateCcw, ShieldAlert, Stethoscope, Zap } from "lucide-react";
import type { ExplainStage } from "@/lib/diagnose/view";
import type { Assessment, Urgency } from "@/lib/diagnose/schema";
import { cn } from "@/lib/utils";

const URGENCY: Record<Urgency, { label: string; className: string; action: string }> = {
  self_care: {
    label: "Likely manageable at home",
    className: "border-[#bfe7d9] bg-[#ecfaf5] text-[#0f5a53]",
    action: "Self-care is usually enough. See a doctor if it isn't improving.",
  },
  see_gp: {
    label: "See a GP",
    className: "border-[#f3dfa4] bg-[#fff9e8] text-[#7a5a00]",
    action: "Book a visit with a GP in the next few days.",
  },
  urgent: {
    label: "Get seen today",
    className: "border-[#f6c4a3] bg-[#fff2e9] text-[#9a3f0c]",
    action: "See a doctor today, at a clinic or urgent care.",
  },
  emergency: {
    label: "Emergency",
    className: "border-[#f3b0b0] bg-[#fff0f0] text-[#a01818]",
    action: "Call 999 or go to the nearest emergency department now.",
  },
};

const LIKELIHOOD: Record<Assessment["differentials"][number]["likelihood"], string> = {
  more_likely: "More likely",
  possible: "Possible",
  less_likely: "Less likely",
};

export function AiDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex gap-3 rounded-2xl border border-[#f1c9a8] bg-[#fff6ee] text-[#6b3d1c]", compact ? "p-3 text-xs" : "p-4 text-sm")}>
      <Bot className="mt-0.5 size-5 shrink-0" />
      <div className="leading-relaxed">
        <p className="font-semibold">AI-generated. This is not a diagnosis.</p>
        <p>
          It was written by an AI model from your answers alone. It may be wrong or incomplete and does not replace
          seeing a doctor or pharmacist. Check medicine labels and ask a pharmacist before taking anything new. If
          you feel worse or are worried, get medical help.
        </p>
      </div>
    </div>
  );
}

export function EmergencyPanel({
  reasons,
  onContinue,
}: {
  reasons: { id: string; reason: string }[];
  onContinue?: () => void;
}) {
  return (
    <div role="alert" className="rounded-2xl border-2 border-[#e05252] bg-[#fff0f0] p-5 text-[#7d1010]">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <ShieldAlert className="size-6" />
        This could be an emergency
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {reasons.map((r) => (
          <li key={r.id}>{r.reason}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-medium">Don&apos;t wait for an online answer. Call 999 or go to the nearest emergency department now.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a href="tel:999" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#c81e1e] px-5 text-sm font-semibold text-white hover:bg-[#a91818]">
          <Phone className="size-4" /> Call 999
        </a>
        {onContinue ? (
          <button type="button" onClick={onContinue} className="inline-flex h-11 items-center justify-center rounded-full border border-[#e05252]/40 px-5 text-sm text-[#7d1010] hover:bg-white">
            I&apos;m getting help. Show me general information anyway
          </button>
        ) : null}
      </div>
    </div>
  );
}

const STAGES: { stage: ExplainStage; title: string; icon: typeof Zap; key: keyof Assessment["painExplanation"] }[] = [
  { stage: 0, title: "Where it starts", icon: Zap, key: "source" },
  { stage: 1, title: "The signal travels", icon: Stethoscope, key: "signal" },
  { stage: 2, title: "Your brain feels it", icon: Brain, key: "brain" },
  { stage: 3, title: "Why it can be felt elsewhere", icon: AlertTriangle, key: "referred" },
];

export function PainExplainer({
  assessment,
  stage,
  onStage,
}: {
  assessment: Assessment;
  stage: ExplainStage;
  onStage: (stage: ExplainStage) => void;
}) {
  const stages = STAGES.filter((s) => s.stage !== 3 || assessment.painExplanation.referred.trim());
  return (
    <section>
      <h3 className="text-sm font-semibold tracking-wide text-[#143632] uppercase">How you feel this pain</h3>
      <p className="mt-1 text-xs text-[#5f7a76]">Tap a step to follow the signal on the 3D model.</p>
      <ol className="mt-3 space-y-2">
        {stages.map(({ stage: s, title, icon: Icon, key }, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onStage(s)}
              aria-pressed={stage === s}
              className={cn(
                "w-full rounded-2xl border p-3 text-left transition-colors",
                stage === s ? "border-[#0f5a53] bg-[#ecfaf5]" : "border-[#e2d9cd] bg-white hover:bg-[#f8f4ee]"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-[#143632]">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#ffd166] text-[11px] font-semibold text-[#083a39]">{i + 1}</span>
                <Icon className="size-4 text-[#0f5a53]" />
                {title}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[#395652]">{assessment.painExplanation[key]}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Results({
  assessment,
  redFlags,
  stage,
  onStage,
  onRestart,
}: {
  assessment: Assessment;
  redFlags: { id: string; reason: string }[];
  stage: ExplainStage;
  onStage: (stage: ExplainStage) => void;
  onRestart: () => void;
}) {
  const urgency = URGENCY[assessment.urgency];
  const otc = assessment.medications.filter((m) => m.kind === "otc");
  const rx = assessment.medications.filter((m) => m.kind === "doctor_may_prescribe");

  return (
    <div className="space-y-6">
      <AiDisclaimer />

      {redFlags.length ? <EmergencyPanel reasons={redFlags} /> : null}

      <div className={cn("rounded-2xl border p-4", urgency.className)}>
        <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-80">Suggested next step</p>
        <p className="mt-1 text-xl font-semibold">{urgency.label}</p>
        <p className="mt-1 text-sm">{urgency.action}</p>
        <p className="mt-2 text-sm opacity-90">{assessment.urgencyReason}</p>
      </div>

      <p className="text-sm leading-relaxed text-[#395652]">{assessment.summary}</p>

      <section>
        <h3 className="text-sm font-semibold tracking-wide text-[#143632] uppercase">Possible causes</h3>
        <ul className="mt-3 space-y-2">
          {assessment.differentials.map((d) => (
            <li key={d.condition} className="rounded-2xl border border-[#e2d9cd] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-[#143632]">{d.condition}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs",
                    d.likelihood === "more_likely" ? "bg-[#0f5a53] text-white" : d.likelihood === "possible" ? "bg-[#daf6f1] text-[#0f5a53]" : "bg-[#f1ece4] text-[#6f8783]"
                  )}
                >
                  {LIKELIHOOD[d.likelihood]}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#5f7a76]">{d.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <PainExplainer assessment={assessment} stage={stage} onStage={onStage} />

      {assessment.medications.length ? (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[#143632] uppercase">
            <Pill className="size-4" /> Medicines to ask about
          </h3>
          <p className="mt-1 text-xs text-[#5f7a76]">Always read the label and check with a pharmacist, especially if you are pregnant, have other conditions or take other medicines.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[...otc, ...rx].map((m) => (
              <div key={m.name} className="rounded-2xl border border-[#e2d9cd] bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <span className="font-medium text-[#143632]">{m.name}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", m.kind === "otc" ? "bg-[#daf6f1] text-[#0f5a53]" : "bg-[#efe8ff] text-[#6a52f2]")}>
                    {m.kind === "otc" ? "Pharmacy (OTC)" : "Doctor may prescribe"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#395652]">{m.purpose}</p>
                <p className="mt-1 text-xs text-[#9a3f0c]">Caution: {m.cautions}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {assessment.selfCare.length ? (
          <section className="rounded-2xl border border-[#e2d9cd] bg-white p-4">
            <h3 className="text-sm font-semibold text-[#143632]">Things you can do now</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#395652]">
              {assessment.selfCare.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {assessment.seeDoctorIf.length ? (
          <section className="rounded-2xl border border-[#f6c4a3] bg-[#fff8f3] p-4">
            <h3 className="text-sm font-semibold text-[#9a3f0c]">Get medical help if</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#6b3d1c]">
              {assessment.seeDoctorIf.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <AiDisclaimer compact />

      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={onRestart} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e2d9cd] bg-white px-4 text-sm hover:bg-[#f8f4ee]">
          <RotateCcw className="size-4" /> Start over
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e2d9cd] bg-white px-4 text-sm hover:bg-[#f8f4ee]">
          <Printer className="size-4" /> Print / save for my doctor
        </button>
      </div>
    </div>
  );
}
