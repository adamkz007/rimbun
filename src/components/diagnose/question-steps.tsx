"use client";

import { REGIONS, getRegion, type RegionId } from "@/lib/diagnose/anatomy";
import {
  AGE_OPTIONS,
  AGGRAVATOR_OPTIONS,
  CHARACTER_OPTIONS,
  DURATION_OPTIONS,
  getSymptomOptions,
  isChild,
  MAX_CHARACTER,
  MAX_TEXT,
  needsSide,
  ONSET_OPTIONS,
  PATTERN_OPTIONS,
  PREGNANCY_OPTIONS,
  SEX_OPTIONS,
  SIDE_OPTIONS,
  withRegion,
  type DiagnoseAnswers,
  type StepId,
} from "@/lib/diagnose/questions";
import { getRedFlagOptions, NO_RED_FLAGS } from "@/lib/diagnose/red-flags";
import type { FollowUps } from "@/lib/diagnose/schema";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FieldLabel, MultiChoice, SingleChoice } from "./choice-chips";

type Props = {
  step: StepId;
  answers: DiagnoseAnswers;
  update: (patch: Partial<DiagnoseAnswers>) => void;
  setAnswers: (answers: DiagnoseAnswers) => void;
  followUps: FollowUps | null;
};

const SEVERITY_LABELS = ["No pain", "", "Mild", "", "Moderate", "", "Severe", "", "Very severe", "", "Worst imaginable"];

function FreeText({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <Textarea
      aria-label={label}
      value={value}
      maxLength={MAX_TEXT}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-20 rounded-2xl border-[#e2d9cd] bg-white text-sm"
    />
  );
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1", className)}>{children}</div>;
}

export function QuestionStep({ step, answers: a, update, setAnswers, followUps }: Props) {
  const region = getRegion(a.region);

  switch (step) {
    case "about":
      return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#f1c9a8] bg-[#fff6ee] p-4 text-sm leading-6 text-[#6b3d1c]">
            <p className="font-semibold">This is an AI tool, not a doctor.</p>
            <p className="mt-1">
              It gives general information to help you decide what to do next. It can be wrong, it cannot examine
              you, and it does not replace a medical consultation. In an emergency call <strong>999</strong>.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[#0f5a53]"
                checked={a.consent}
                onChange={(e) => update({ consent: e.target.checked })}
              />
              <span>I understand this is not medical advice or a diagnosis.</span>
            </label>
          </div>
          <Section>
            <FieldLabel>Age</FieldLabel>
            <SingleChoice label="Age" options={AGE_OPTIONS} value={a.ageBand} onChange={(v) => update({ ageBand: v as DiagnoseAnswers["ageBand"] })} />
          </Section>
          <Section>
            <FieldLabel>Sex</FieldLabel>
            <SingleChoice label="Sex" options={SEX_OPTIONS} value={a.sex} onChange={(v) => update({ sex: v as DiagnoseAnswers["sex"], pregnant: null })} />
          </Section>
          {a.sex === "female" && !isChild(a) ? (
            <Section>
              <FieldLabel>Could you be pregnant?</FieldLabel>
              <SingleChoice label="Pregnancy" options={PREGNANCY_OPTIONS} value={a.pregnant} onChange={(v) => update({ pregnant: v as DiagnoseAnswers["pregnant"] })} />
            </Section>
          ) : null}
        </div>
      );

    case "region":
      return (
        <div className="space-y-6">
          <Section>
            <FieldLabel hint="Tap the body model, or choose below.">Area</FieldLabel>
            <SingleChoice
              label="Area"
              options={REGIONS.map((r) => ({ value: r.id, label: r.label }))}
              value={a.region}
              onChange={(v) => setAnswers(withRegion(a, v as RegionId))}
            />
          </Section>
          {needsSide(a) ? (
            <Section>
              <FieldLabel>Which side?</FieldLabel>
              <SingleChoice label="Side" options={SIDE_OPTIONS} value={a.side} onChange={(v) => update({ side: v as DiagnoseAnswers["side"] })} />
            </Section>
          ) : null}
        </div>
      );

    case "spot":
      return (
        <Section>
          <FieldLabel hint="The model zooms to the spot you pick.">{region ? `Where in your ${region.label.toLowerCase()}?` : "Where?"}</FieldLabel>
          <SingleChoice
            label="Exact location"
            options={(region?.subLocations ?? []).map((s) => ({ value: s.id, label: s.label, hint: s.hint }))}
            value={a.subLocation}
            onChange={(v) => update({ subLocation: v })}
          />
        </Section>
      );

    case "character":
      return (
        <div className="space-y-6">
          <Section>
            <FieldLabel hint={`Pick up to ${MAX_CHARACTER}.`}>The pain feels…</FieldLabel>
            <MultiChoice label="Pain character" options={CHARACTER_OPTIONS} values={a.character} max={MAX_CHARACTER} onChange={(v) => update({ character: v })} />
          </Section>
          <Section>
            <FieldLabel hint="Optional">Describe it in your own words</FieldLabel>
            <FreeText label="Describe the pain" value={a.characterOther} onChange={(v) => update({ characterOther: v })} placeholder="e.g. like a band squeezing, worse when I bend down" />
          </Section>
        </div>
      );

    case "severity": {
      const severity = a.severity ?? 5;
      return (
        <div className="space-y-7">
          <Section>
            <FieldLabel hint="0 is no pain, 10 is the worst pain you can imagine.">Pain score right now</FieldLabel>
            <div className="rounded-2xl border border-[#e2d9cd] bg-white p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-4xl font-semibold tracking-tight text-[#0f5a53]">{a.severity ?? "–"}</span>
                <span className="text-sm text-[#5f7a76]">{a.severity !== null ? SEVERITY_LABELS[severity] || SEVERITY_LABELS[severity - 1] : "Move the slider"}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={severity}
                aria-label="Pain score"
                onChange={(e) => update({ severity: Number(e.target.value) })}
                onClick={() => a.severity === null && update({ severity })}
                className="mt-4 w-full accent-[#e4572e]"
                style={{ accentColor: `hsl(${120 - severity * 12} 70% 42%)` }}
              />
              <div className="mt-1 flex justify-between text-[11px] text-[#7b918d]">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          </Section>
          <Section>
            <FieldLabel>How did it start?</FieldLabel>
            <SingleChoice label="Onset" options={ONSET_OPTIONS} value={a.onset} onChange={(v) => update({ onset: v })} />
          </Section>
        </div>
      );
    }

    case "timing":
      return (
        <div className="space-y-6">
          <Section>
            <FieldLabel>How long have you had it?</FieldLabel>
            <SingleChoice label="Duration" options={DURATION_OPTIONS} value={a.duration} onChange={(v) => update({ duration: v })} />
          </Section>
          <Section>
            <FieldLabel>Is it…</FieldLabel>
            <SingleChoice label="Pattern" options={PATTERN_OPTIONS} value={a.pattern} onChange={(v) => update({ pattern: v })} />
          </Section>
          <Section>
            <FieldLabel hint="Optional, pick any">What affects it?</FieldLabel>
            <MultiChoice label="Triggers" options={AGGRAVATOR_OPTIONS} values={a.aggravators} onChange={(v) => update({ aggravators: v })} />
          </Section>
        </div>
      );

    case "symptoms":
      return (
        <div className="space-y-6">
          <Section>
            <FieldLabel hint="Optional, pick any that apply">Other symptoms</FieldLabel>
            <MultiChoice label="Other symptoms" options={getSymptomOptions(a.region)} values={a.symptoms} onChange={(v) => update({ symptoms: v })} />
          </Section>
          <Section>
            <FieldLabel hint="Optional">Anything else? (other symptoms, conditions, medicines you take, allergies)</FieldLabel>
            <FreeText label="Other symptoms" value={a.symptomsOther} onChange={(v) => update({ symptomsOther: v })} placeholder="e.g. I have asthma and I'm allergic to penicillin" />
          </Section>
        </div>
      );

    case "red_flags":
      return (
        <Section>
          <FieldLabel hint="These signs need urgent care. Pick any that apply, or 'None of these'.">Do you have any of these right now?</FieldLabel>
          <MultiChoice
            label="Emergency signs"
            options={[...getRedFlagOptions(a.region), { value: NO_RED_FLAGS, label: "None of these" }]}
            values={a.redFlags}
            exclusive={NO_RED_FLAGS}
            onChange={(v) => update({ redFlags: v })}
          />
        </Section>
      );

    case "follow_up":
      return (
        <div className="space-y-6">
          {(followUps?.questions ?? []).map((q) => {
            const current = a.followUps.find((f) => f.id === q.id);
            const optionValue = current && q.options.includes(current.answer) ? current.answer : null;
            const typed = current && !q.options.includes(current.answer) ? current.answer : "";
            const setAnswer = (answer: string) =>
              update({
                followUps: [...a.followUps.filter((f) => f.id !== q.id), { id: q.id, question: q.text, answer }],
              });
            return (
              <Section key={q.id}>
                <FieldLabel>{q.text}</FieldLabel>
                <SingleChoice label={q.text} options={q.options.map((o) => ({ value: o, label: o }))} value={optionValue} onChange={setAnswer} />
                {q.allowFreeText ? (
                  <input
                    aria-label={`${q.text} (type your own answer)`}
                    value={typed}
                    maxLength={MAX_TEXT}
                    placeholder="Or type your own answer"
                    onChange={(e) => setAnswer(e.target.value)}
                    className="mt-2 h-10 w-full rounded-full border border-[#e2d9cd] bg-white px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-[#0f5a53]/30"
                  />
                ) : null}
              </Section>
            );
          })}
          <Section>
            <FieldLabel hint="Optional">Anything else you want to add?</FieldLabel>
            <FreeText label="Anything else" value={a.notes} onChange={(v) => update({ notes: v })} placeholder="Anything that might help" />
          </Section>
        </div>
      );

    case "results":
      return null;
  }
}
