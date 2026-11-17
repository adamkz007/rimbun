import type { PatientLanguage } from "../care-loop/catalogue.ts";

// Safety-net follow-up question sets: what the clinic asks a patient a day or
// two after a visit where the doctor could not confirm the cause on the spot.
//
// DRAFT CONTENT. These questions, timings and routes are prototype defaults
// written from general primary-care safety-netting practice. They have not been
// reviewed by a clinician and must be signed off by the clinical lead (against
// the relevant Malaysian clinical practice guidelines) before real use.
//
// Every question is answered with buttons. WhatsApp reply buttons allow at most
// three options with titles of 20 characters, so the sets keep to that.

export type Localized = Record<PatientLanguage, string>;

/** green: improving, nothing to do. amber: a nurse calls. red: emergency advice and a doctor alert. */
export type Route = "green" | "amber" | "red";

export const ROUTES: Route[] = ["green", "amber", "red"];

export type QuestionOption = { value: string; label: Localized; route: Route };

export type Question = {
  id: string;
  text: Localized;
  options: QuestionOption[];
  /** The warning sign this question watches. Questions without one are always asked. */
  sign?: string;
};

export type WarningSign = { id: string; label: string };

export type Protocol = {
  code: string;
  version: number;
  label: string;
  /** Who the messages talk about: the patient themself, or a child via a parent. */
  subject: "self" | "child";
  /** Shown to the doctor when choosing a set. */
  summary: string;
  defaultCheckInHours: number;
  timingNote: string;
  signs: WarningSign[];
  /** Route for the opening "Better / Same / Worse" tap. */
  openerRoutes: Record<OpenerValue, Route>;
  questions: Question[];
};

export const OPENER_VALUES = ["better", "same", "worse"] as const;
export type OpenerValue = (typeof OPENER_VALUES)[number];

export const PROTOCOL_STATUS = "Draft: not clinically reviewed";

const YES = { en: "Yes", ms: "Ya" };
const NO = { en: "No", ms: "Tidak" };
const NOT_SURE = { en: "Not sure", ms: "Tidak pasti" };

function yesNo(yesRoute: Route, noRoute: Route): QuestionOption[] {
  return [
    { value: "no", label: NO, route: noRoute },
    { value: "yes", label: YES, route: yesRoute },
  ];
}

export const PROTOCOLS: Protocol[] = [
  {
    code: "adult_fever",
    version: 1,
    label: "Adult fever (dengue watch)",
    subject: "self",
    summary: "Fever without a confirmed cause, where dengue is possible.",
    defaultCheckInHours: 48,
    timingNote:
      "Dengue warning signs tend to appear around days 3 to 7 of the fever, often as the fever settles. Time the check-in for that window.",
    signs: [
      { id: "abdominal_pain", label: "Severe abdominal pain" },
      { id: "bleeding", label: "Bleeding (gums, nose, black stools)" },
      { id: "low_urine", label: "Passing little urine" },
      { id: "drowsy", label: "Drowsy, restless or confused" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "amber" },
    questions: [
      {
        id: "fever_now",
        text: { en: "Do you still have a fever?", ms: "Adakah anda masih demam?" },
        options: [
          { value: "no", label: NO, route: "green" },
          { value: "yes", label: YES, route: "amber" },
          { value: "not_sure", label: NOT_SURE, route: "amber" },
        ],
      },
      {
        id: "fluids",
        text: {
          en: "Can you drink and keep fluids down?",
          ms: "Bolehkah anda minum tanpa memuntahkannya?",
        },
        options: [
          { value: "yes", label: YES, route: "green" },
          { value: "some_vomiting", label: { en: "Some vomiting", ms: "Muntah sedikit" }, route: "amber" },
          { value: "cannot", label: { en: "Can't keep fluids", ms: "Tak boleh minum" }, route: "red" },
        ],
      },
      {
        id: "abdominal_pain",
        sign: "abdominal_pain",
        text: { en: "Do you have severe stomach pain?", ms: "Adakah anda sakit perut yang teruk?" },
        options: yesNo("red", "green"),
      },
      {
        id: "bleeding",
        sign: "bleeding",
        text: {
          en: "Any bleeding from your gums or nose, or black stools?",
          ms: "Adakah gusi atau hidung anda berdarah, atau najis berwarna hitam?",
        },
        options: yesNo("red", "green"),
      },
      {
        id: "urine",
        sign: "low_urine",
        text: {
          en: "Have you passed urine in the last 6 hours?",
          ms: "Adakah anda sudah kencing dalam 6 jam yang lalu?",
        },
        options: yesNo("green", "red"),
      },
      {
        id: "drowsy",
        sign: "drowsy",
        text: {
          en: "Are you unusually sleepy, restless or confused?",
          ms: "Adakah anda luar biasa mengantuk, gelisah atau keliru?",
        },
        options: yesNo("red", "green"),
      },
    ],
  },
  {
    code: "child_fever",
    version: 1,
    label: "Child with fever or vomiting",
    subject: "child",
    summary: "A child with fever, vomiting or diarrhoea; questions go to the parent.",
    defaultCheckInHours: 24,
    timingNote: "Children can dehydrate quickly. Check within a day.",
    signs: [
      { id: "low_urine", label: "Fewer wet nappies / passing little urine" },
      { id: "drowsy", label: "Drowsy or hard to wake" },
      { id: "breathing", label: "Fast or difficult breathing" },
      { id: "rash", label: "Rash that doesn't fade under a glass" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "amber" },
    questions: [
      {
        id: "drinking",
        text: { en: "Is your child drinking?", ms: "Adakah anak anda minum?" },
        options: [
          { value: "well", label: { en: "Drinking well", ms: "Minum seperti biasa" }, route: "green" },
          { value: "less", label: { en: "Less than usual", ms: "Kurang dari biasa" }, route: "amber" },
          { value: "not", label: { en: "Not drinking", ms: "Tidak minum" }, route: "red" },
        ],
      },
      {
        id: "vomiting",
        text: { en: "Is your child still vomiting?", ms: "Adakah anak anda masih muntah?" },
        options: [
          { value: "no", label: NO, route: "green" },
          { value: "sometimes", label: { en: "Sometimes", ms: "Kadang-kadang" }, route: "amber" },
          { value: "keeps", label: { en: "Keeps vomiting", ms: "Muntah berterusan" }, route: "red" },
        ],
      },
      {
        id: "wet",
        sign: "low_urine",
        text: {
          en: "Has your child passed urine or had a wet nappy in the last 8 hours?",
          ms: "Adakah anak anda kencing atau lampinnya basah dalam 8 jam yang lalu?",
        },
        options: yesNo("green", "red"),
      },
      {
        id: "alert",
        sign: "drowsy",
        text: {
          en: "Is your child alert and responding to you as usual?",
          ms: "Adakah anak anda cergas dan memberi respons seperti biasa?",
        },
        options: [
          { value: "usual", label: { en: "Yes, as usual", ms: "Ya, seperti biasa" }, route: "green" },
          { value: "sleepier", label: { en: "Sleepier than usual", ms: "Lebih mengantuk" }, route: "amber" },
          { value: "hard_to_wake", label: { en: "Hard to wake", ms: "Susah dikejutkan" }, route: "red" },
        ],
      },
      {
        id: "breathing",
        sign: "breathing",
        text: {
          en: "Is your child breathing fast or working hard to breathe?",
          ms: "Adakah anak anda bernafas laju atau susah bernafas?",
        },
        options: yesNo("red", "green"),
      },
      {
        id: "rash",
        sign: "rash",
        text: {
          en: "Any new rash that doesn't fade when you press a glass on it?",
          ms: "Adakah ruam baru yang tidak pudar apabila ditekan dengan gelas?",
        },
        options: [
          { value: "no", label: NO, route: "green" },
          { value: "yes", label: YES, route: "red" },
          { value: "not_sure", label: NOT_SURE, route: "amber" },
        ],
      },
    ],
  },
  {
    code: "abdominal_pain",
    version: 1,
    label: "Abdominal pain (appendicitis watch)",
    subject: "self",
    summary: "Abdominal pain without a clear cause, where early appendicitis is possible.",
    defaultCheckInHours: 12,
    timingNote: "Early appendicitis can change within a day. Check the same evening or the next morning.",
    signs: [
      { id: "pain_moved", label: "Pain moving to the lower right" },
      { id: "movement", label: "Pain worse when walking or coughing" },
      { id: "fever", label: "Fever" },
      { id: "vomiting", label: "Vomiting or unable to eat" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "red" },
    questions: [
      {
        id: "pain_now",
        text: { en: "How is the pain now?", ms: "Bagaimana sakit anda sekarang?" },
        options: [
          { value: "better", label: { en: "Gone or better", ms: "Hilang/berkurang" }, route: "green" },
          { value: "same", label: { en: "About the same", ms: "Lebih kurang sama" }, route: "amber" },
          { value: "worse", label: { en: "Worse", ms: "Lebih teruk" }, route: "red" },
        ],
      },
      {
        id: "pain_moved",
        sign: "pain_moved",
        text: {
          en: "Has the pain moved to the lower right side of your belly?",
          ms: "Adakah sakit beralih ke bahagian kanan bawah perut anda?",
        },
        options: yesNo("red", "green"),
      },
      {
        id: "movement",
        sign: "movement",
        text: {
          en: "Does walking or coughing make the pain worse?",
          ms: "Adakah berjalan atau batuk menambah sakit?",
        },
        options: yesNo("amber", "green"),
      },
      {
        id: "fever",
        sign: "fever",
        text: { en: "Do you have a fever?", ms: "Adakah anda demam?" },
        options: yesNo("amber", "green"),
      },
      {
        id: "vomiting",
        sign: "vomiting",
        text: {
          en: "Are you vomiting or unable to eat?",
          ms: "Adakah anda muntah atau tidak boleh makan?",
        },
        options: yesNo("amber", "green"),
      },
    ],
  },
  {
    code: "head_injury",
    version: 1,
    label: "Headache or minor head injury",
    subject: "self",
    summary: "A new headache or a minor head injury sent home for observation.",
    defaultCheckInHours: 24,
    timingNote: "Most problems after a minor head injury show within 24 hours.",
    signs: [
      { id: "vomiting", label: "Repeated vomiting" },
      { id: "confusion", label: "Confusion, drowsiness or trouble speaking" },
      { id: "neuro", label: "Weakness, numbness or vision problems" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "red" },
    questions: [
      {
        id: "headache",
        text: { en: "How is the headache now?", ms: "Bagaimana sakit kepala anda sekarang?" },
        options: [
          { value: "easing", label: { en: "Gone or easing", ms: "Hilang/berkurang" }, route: "green" },
          { value: "same", label: { en: "About the same", ms: "Lebih kurang sama" }, route: "amber" },
          { value: "worse", label: { en: "Getting worse", ms: "Semakin teruk" }, route: "red" },
        ],
      },
      {
        id: "vomiting",
        sign: "vomiting",
        text: {
          en: "Have you vomited more than once?",
          ms: "Adakah anda muntah lebih daripada sekali?",
        },
        options: yesNo("red", "green"),
      },
      {
        id: "confusion",
        sign: "confusion",
        text: {
          en: "Any confusion, unusual drowsiness or trouble speaking?",
          ms: "Adakah anda keliru, luar biasa mengantuk atau susah bercakap?",
        },
        options: yesNo("red", "green"),
      },
      {
        id: "neuro",
        sign: "neuro",
        text: {
          en: "Any new weakness, numbness or problems with your vision?",
          ms: "Adakah anda rasa lemah, kebas atau penglihatan terganggu?",
        },
        options: yesNo("red", "green"),
      },
    ],
  },
];

export function getProtocol(code: string) {
  return PROTOCOLS.find((protocol) => protocol.code === code) ?? null;
}

/**
 * The questions to ask, in protocol order: every question without a sign, plus
 * the questions for the warning signs the doctor chose to watch.
 */
export function buildQuestionIds(protocol: Protocol, signs: string[]) {
  const chosen = new Set(signs);
  return protocol.questions
    .filter((question) => !question.sign || chosen.has(question.sign))
    .map((question) => question.id);
}

/** Keeps only sign ids that exist in the protocol. */
export function validSigns(protocol: Protocol, signs: string[]) {
  const known = new Set(protocol.signs.map((sign) => sign.id));
  return [...new Set(signs)].filter((sign) => known.has(sign));
}

export function getQuestion(protocol: Protocol, questionId: string) {
  return protocol.questions.find((question) => question.id === questionId) ?? null;
}

export const OPENER_LABELS: Record<OpenerValue, Localized> = {
  better: { en: "Better", ms: "Lebih baik" },
  same: { en: "Same", ms: "Sama" },
  worse: { en: "Worse", ms: "Lebih teruk" },
};
