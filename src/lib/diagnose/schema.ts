import { z } from "zod";
import { REFERRED_AREA_IDS, REGION_IDS, STRUCTURE_KEYS, type StructureKey } from "./anatomy.ts";
import { MAX_TEXT } from "./questions.ts";

const shortText = z.string().trim().max(MAX_TEXT);
const token = z.string().trim().min(1).max(60);
const tokenList = z.array(token).max(20);

export const answersSchema = z.object({
  consent: z.literal(true),
  ageBand: z.enum(["under_12", "12_17", "18_39", "40_64", "65_plus"]),
  sex: z.enum(["female", "male", "intersex", "prefer_not"]),
  pregnant: z.enum(["yes", "no", "unsure"]).nullable(),
  region: z.enum(REGION_IDS),
  side: z.enum(["left", "right", "both"]).nullable(),
  subLocation: token,
  character: tokenList,
  characterOther: shortText,
  severity: z.number().int().min(0).max(10),
  onset: token,
  duration: token,
  pattern: token,
  aggravators: tokenList,
  symptoms: tokenList,
  symptomsOther: shortText,
  redFlags: tokenList,
  notes: shortText,
  followUps: z
    .array(z.object({ id: token, question: z.string().trim().max(300), answer: shortText }))
    .max(6),
});

export const requestSchema = z.object({
  answers: answersSchema,
  /** Set once the user has read the emergency advice and still wants the summary. */
  acknowledgedEmergency: z.boolean().optional().default(false),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0).optional(),
});

export type DiagnoseRequest = z.infer<typeof requestSchema>;
export type ValidAnswers = z.infer<typeof answersSchema>;

// ---- Model outputs (kept free of length constraints for structured outputs) ----

export const followUpsSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      options: z.array(z.string()),
      allowFreeText: z.boolean(),
    })
  ),
});

export type FollowUps = z.infer<typeof followUpsSchema>;

export const URGENCY_LEVELS = ["self_care", "see_gp", "urgent", "emergency"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const assessmentSchema = z.object({
  urgency: z.enum(URGENCY_LEVELS),
  urgencyReason: z.string(),
  summary: z.string(),
  differentials: z.array(
    z.object({
      condition: z.string(),
      likelihood: z.enum(["more_likely", "possible", "less_likely"]),
      why: z.string(),
    })
  ),
  painExplanation: z.object({
    source: z.string(),
    signal: z.string(),
    brain: z.string(),
    referred: z.string(),
  }),
  focusStructures: z.array(z.enum(STRUCTURE_KEYS as [StructureKey, ...StructureKey[]])),
  referredTo: z.array(z.enum(REFERRED_AREA_IDS)),
  medications: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["otc", "doctor_may_prescribe"]),
      purpose: z.string(),
      cautions: z.string(),
    })
  ),
  selfCare: z.array(z.string()),
  seeDoctorIf: z.array(z.string()),
});

export type Assessment = z.infer<typeof assessmentSchema>;

/** Clamp model output to sane sizes before it reaches the browser. */
export function trimAssessment(a: Assessment): Assessment {
  return {
    ...a,
    differentials: a.differentials.slice(0, 5),
    focusStructures: [...new Set(a.focusStructures)].slice(0, 6),
    referredTo: [...new Set(a.referredTo)].slice(0, 3),
    medications: a.medications.slice(0, 6),
    selfCare: a.selfCare.slice(0, 8),
    seeDoctorIf: a.seeDoctorIf.slice(0, 8),
  };
}

export function trimFollowUps(f: FollowUps): FollowUps {
  return {
    questions: f.questions.slice(0, 4).map((q, i) => ({
      id: q.id?.slice(0, 40) || `q${i + 1}`,
      text: q.text.slice(0, 300),
      options: q.options.slice(0, 6).map((o) => o.slice(0, 80)),
      allowFreeText: q.allowFreeText,
    })),
  };
}

export type AssessResponse =
  | { kind: "assessment"; assessment: Assessment; redFlags: { id: string; reason: string }[] }
  | { kind: "emergency"; redFlags: { id: string; reason: string }[] };

export type FollowUpResponse =
  | { kind: "follow_up"; followUps: FollowUps }
  | { kind: "emergency"; redFlags: { id: string; reason: string }[] };
