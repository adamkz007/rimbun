import type { RegionId, Side } from "./anatomy.ts";

export type Option = { value: string; label: string; hint?: string };

export type AgeBand = "under_12" | "12_17" | "18_39" | "40_64" | "65_plus";
export type Sex = "female" | "male" | "intersex" | "prefer_not";

export type FollowUpAnswer = { id: string; question: string; answer: string };

export type DiagnoseAnswers = {
  consent: boolean;
  ageBand: AgeBand | null;
  sex: Sex | null;
  pregnant: "yes" | "no" | "unsure" | null;
  region: RegionId | null;
  side: Side | null;
  subLocation: string | null;
  character: string[];
  characterOther: string;
  severity: number | null;
  onset: string | null;
  duration: string | null;
  pattern: string | null;
  aggravators: string[];
  symptoms: string[];
  symptomsOther: string;
  redFlags: string[];
  notes: string;
  followUps: FollowUpAnswer[];
};

export const EMPTY_ANSWERS: DiagnoseAnswers = {
  consent: false,
  ageBand: null,
  sex: null,
  pregnant: null,
  region: null,
  side: null,
  subLocation: null,
  character: [],
  characterOther: "",
  severity: null,
  onset: null,
  duration: null,
  pattern: null,
  aggravators: [],
  symptoms: [],
  symptomsOther: "",
  redFlags: [],
  notes: "",
  followUps: [],
};

export const AGE_OPTIONS: Option[] = [
  { value: "under_12", label: "Under 12" },
  { value: "12_17", label: "12–17" },
  { value: "18_39", label: "18–39" },
  { value: "40_64", label: "40–64" },
  { value: "65_plus", label: "65+" },
];

export const SEX_OPTIONS: Option[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "intersex", label: "Intersex" },
  { value: "prefer_not", label: "Prefer not to say" },
];

export const PREGNANCY_OPTIONS: Option[] = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "unsure", label: "Not sure" },
];

export const SIDE_OPTIONS: Option[] = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "both", label: "Both sides" },
];

export const CHARACTER_OPTIONS: Option[] = [
  { value: "sharp", label: "Sharp", hint: "like a knife or a jab" },
  { value: "dull_aching", label: "Dull / aching" },
  { value: "burning", label: "Burning" },
  { value: "throbbing", label: "Throbbing / pulsing" },
  { value: "cramping", label: "Cramping / colicky", hint: "comes in waves" },
  { value: "stabbing", label: "Stabbing" },
  { value: "pressure", label: "Pressure / tightness / heaviness" },
  { value: "shooting", label: "Shooting / electric", hint: "travels along a line" },
  { value: "tingling", label: "Tingling / pins and needles" },
  { value: "tender", label: "Tender to touch" },
];

export const ONSET_OPTIONS: Option[] = [
  { value: "sudden", label: "Suddenly (seconds to minutes)" },
  { value: "gradual", label: "Gradually (hours to days)" },
  { value: "after_injury", label: "After an injury or fall" },
  { value: "after_activity", label: "After exercise or strain" },
  { value: "after_food", label: "After eating" },
];

export const DURATION_OPTIONS: Option[] = [
  { value: "under_1h", label: "Less than an hour" },
  { value: "1_24h", label: "1–24 hours" },
  { value: "1_7d", label: "1–7 days" },
  { value: "1_4w", label: "1–4 weeks" },
  { value: "over_1m", label: "More than a month" },
  { value: "recurring", label: "Comes back on and off for months" },
];

export const PATTERN_OPTIONS: Option[] = [
  { value: "constant", label: "Constant" },
  { value: "comes_and_goes", label: "Comes and goes" },
  { value: "getting_worse", label: "Steadily getting worse" },
  { value: "getting_better", label: "Getting better" },
];

export const AGGRAVATOR_OPTIONS: Option[] = [
  { value: "movement", label: "Moving" },
  { value: "rest", label: "Resting / lying down" },
  { value: "breathing", label: "Breathing in deeply" },
  { value: "coughing", label: "Coughing or sneezing" },
  { value: "eating", label: "Eating" },
  { value: "pressing", label: "Pressing on it" },
  { value: "weight_bearing", label: "Standing / walking on it" },
  { value: "night", label: "Worse at night" },
  { value: "morning", label: "Worse in the morning" },
  { value: "position", label: "Better in certain positions" },
];

const GENERAL_SYMPTOMS: Option[] = [
  { value: "fever", label: "Fever or chills" },
  { value: "nausea", label: "Nausea" },
  { value: "vomiting", label: "Vomiting" },
  { value: "fatigue", label: "Unusual tiredness" },
  { value: "dizziness", label: "Dizziness" },
  { value: "weight_loss", label: "Unexplained weight loss" },
  { value: "swelling", label: "Swelling" },
  { value: "redness_warmth", label: "Redness or warmth" },
];

const REGION_SYMPTOMS: Partial<Record<RegionId, Option[]>> = {
  head: [
    { value: "light_sensitivity", label: "Sensitive to light or noise" },
    { value: "vision_changes", label: "Blurred or changed vision" },
    { value: "stuffy_nose", label: "Blocked nose / sinus pressure" },
    { value: "neck_stiffness", label: "Stiff neck" },
    { value: "aura", label: "Flashing lights / zig-zags before pain" },
  ],
  neck: [
    { value: "sore_throat", label: "Sore throat" },
    { value: "swallow_pain", label: "Pain when swallowing" },
    { value: "swollen_glands", label: "Swollen glands" },
    { value: "arm_tingling", label: "Tingling into the arm" },
  ],
  chest: [
    { value: "shortness_of_breath", label: "Short of breath" },
    { value: "cough", label: "Cough" },
    { value: "palpitations", label: "Racing or irregular heartbeat" },
    { value: "heartburn", label: "Heartburn / sour taste" },
    { value: "sweating", label: "Cold sweat" },
  ],
  abdomen: [
    { value: "diarrhoea", label: "Diarrhoea" },
    { value: "constipation", label: "Constipation" },
    { value: "bloating", label: "Bloating / gas" },
    { value: "heartburn", label: "Heartburn" },
    { value: "loss_of_appetite", label: "Loss of appetite" },
    { value: "painful_urination", label: "Burning when passing urine" },
    { value: "dark_urine", label: "Dark urine / yellow eyes" },
  ],
  back: [
    { value: "leg_pain", label: "Pain travelling down a leg" },
    { value: "leg_numbness", label: "Numbness or tingling in a leg" },
    { value: "stiffness", label: "Morning stiffness" },
    { value: "painful_urination", label: "Burning when passing urine" },
  ],
  pelvis: [
    { value: "painful_urination", label: "Burning when passing urine" },
    { value: "frequent_urination", label: "Needing to pass urine often" },
    { value: "discharge", label: "Unusual discharge" },
    { value: "period_related", label: "Linked to periods" },
    { value: "lump", label: "A lump or bulge" },
  ],
  shoulder: [
    { value: "stiffness", label: "Stiffness / can't lift the arm" },
    { value: "clicking", label: "Clicking or catching" },
    { value: "arm_tingling", label: "Tingling into the arm" },
  ],
  arm: [
    { value: "numbness", label: "Numbness or tingling" },
    { value: "weakness", label: "Weak grip" },
    { value: "stiffness", label: "Stiffness" },
  ],
  hand: [
    { value: "numbness", label: "Numbness or tingling" },
    { value: "stiffness", label: "Morning stiffness" },
    { value: "weakness", label: "Weak grip" },
  ],
  hip: [
    { value: "stiffness", label: "Stiffness" },
    { value: "limp", label: "Limping" },
    { value: "leg_numbness", label: "Numbness or tingling" },
  ],
  knee: [
    { value: "locking", label: "Locking or catching" },
    { value: "giving_way", label: "Giving way" },
    { value: "stiffness", label: "Stiffness" },
    { value: "clicking", label: "Clicking / grinding" },
  ],
  lower_leg: [
    { value: "calf_tender", label: "Tender, tight calf" },
    { value: "numbness", label: "Numbness or tingling" },
    { value: "cramps", label: "Cramps" },
  ],
  foot: [
    { value: "numbness", label: "Numbness or tingling" },
    { value: "first_step_pain", label: "Worst with the first steps in the morning" },
    { value: "stiffness", label: "Stiffness" },
  ],
};

export function getSymptomOptions(region: RegionId | null): Option[] {
  const specific = (region && REGION_SYMPTOMS[region]) || [];
  const seen = new Set<string>();
  return [...specific, ...GENERAL_SYMPTOMS].filter((o) => !seen.has(o.value) && seen.add(o.value));
}

export function optionLabel(options: Option[], value: string | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? value ?? "";
}

export type StepId =
  | "about"
  | "region"
  | "spot"
  | "character"
  | "severity"
  | "timing"
  | "symptoms"
  | "red_flags"
  | "follow_up"
  | "results";

export type StepDef = { id: StepId; title: string; subtitle: string };

export const STEPS: StepDef[] = [
  { id: "about", title: "Before we start", subtitle: "A little about you" },
  { id: "region", title: "Where does it hurt?", subtitle: "Tap the body or pick an area" },
  { id: "spot", title: "Where exactly?", subtitle: "Narrow it down" },
  { id: "character", title: "What does it feel like?", subtitle: "Pick up to three" },
  { id: "severity", title: "How bad is it?", subtitle: "And how did it start" },
  { id: "timing", title: "How long, and what makes it worse?", subtitle: "Timing and triggers" },
  { id: "symptoms", title: "Anything else going on?", subtitle: "Other symptoms" },
  { id: "red_flags", title: "Safety check", subtitle: "Do any of these apply?" },
  { id: "follow_up", title: "A few more questions", subtitle: "Tailored to your answers" },
  { id: "results", title: "Your summary", subtitle: "AI-generated, not a diagnosis" },
];

export const MAX_CHARACTER = 3;
export const MAX_TEXT = 500;

/** Whether the user has answered enough to leave a step. */
export function isStepComplete(step: StepId, a: DiagnoseAnswers): boolean {
  switch (step) {
    case "about":
      return a.consent && !!a.ageBand && !!a.sex && (a.sex !== "female" || !!a.pregnant || isChild(a));
    case "region":
      return !!a.region && (!needsSide(a) || !!a.side);
    case "spot":
      return !!a.subLocation;
    case "character":
      return a.character.length > 0 || a.characterOther.trim().length > 0;
    case "severity":
      return a.severity !== null && !!a.onset;
    case "timing":
      return !!a.duration && !!a.pattern;
    case "symptoms":
      return true;
    case "red_flags":
      return a.redFlags.length > 0;
    case "follow_up":
      return true;
    case "results":
      return true;
  }
}

export function isChild(a: Pick<DiagnoseAnswers, "ageBand">) {
  return a.ageBand === "under_12";
}

export function needsSide(a: Pick<DiagnoseAnswers, "region">) {
  return (
    a.region === "shoulder" ||
    a.region === "arm" ||
    a.region === "hand" ||
    a.region === "hip" ||
    a.region === "knee" ||
    a.region === "lower_leg" ||
    a.region === "foot"
  );
}

/** Reset answers that depend on the region when it changes. */
export function withRegion(a: DiagnoseAnswers, region: RegionId): DiagnoseAnswers {
  if (a.region === region) return a;
  return { ...a, region, side: null, subLocation: null, symptoms: [], redFlags: [], followUps: [] };
}
