import type { PatientLanguage } from "../care-loop/catalogue.ts";

// Safety-net follow-up question sets: what the clinic asks a patient a day or
// two after a visit where the doctor could not confirm the cause on the spot.
//
// DRAFT CONTENT. These questions, causes, effects, timings and routes are
// prototype defaults written from general primary-care safety-netting practice.
// They have not been reviewed by a clinician and must be signed off by the
// clinical lead (against the relevant Malaysian clinical practice guidelines)
// before real use. Patients only ever see questions from this reviewed bank.
//
// Every question is answered with buttons. WhatsApp reply buttons allow at most
// three options with titles of 20 characters, so the sets keep to that.

export type Localized = Record<PatientLanguage, string>;

/** green: improving, nothing to do. amber: a nurse calls. red: emergency advice and a doctor alert. */
export type Route = "green" | "amber" | "red";

export const ROUTES: Route[] = ["green", "amber", "red"];

/** What an answer means for one possible cause. */
export type Effect = "raises" | "rules_out";

export type QuestionOption = {
  value: string;
  label: Localized;
  route: Route;
  /** A few English words for the staff list summary, e.g. "new rash". */
  note?: string;
};

export type Question = {
  id: string;
  text: Localized;
  options: QuestionOption[];
  /** The warning sign this question watches. Questions without one are always in the pool. */
  sign?: string;
  /** What each answer does to each possible cause: cause id → option value → effect. */
  tests?: Record<string, Partial<Record<string, Effect>>>;
};

export type WarningSign = { id: string; label: string };

/** Where a possible cause starts when the doctor sets the follow-up. */
export type StartingLevel = "likely" | "watch" | "possible";
export type CauseLevel = StartingLevel | "ruled_out" | "raised";

export type Cause = { id: string; label: string; defaultLevel: StartingLevel };

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
  /** The possible causes the check-in is meant to tell apart. */
  causes: Cause[];
  /** Route for the opening "Better / Same / Worse" tap. */
  openerRoutes: Record<OpenerValue, Route>;
  questions: Question[];
};

export const OPENER_VALUES = ["better", "same", "worse"] as const;
export type OpenerValue = (typeof OPENER_VALUES)[number];

export const PROTOCOL_STATUS = "Draft: not clinically reviewed";

export const CAUSE_LEVEL_LABELS: Record<CauseLevel, string> = {
  likely: "Likely",
  watch: "Watch",
  possible: "Possible",
  ruled_out: "Ruled out",
  raised: "Raised",
};

export const STARTING_LEVELS: StartingLevel[] = ["likely", "watch", "possible"];

const YES = { en: "Yes", ms: "Ya" };
const NO = { en: "No", ms: "Tidak" };
const NOT_SURE = { en: "Not sure", ms: "Tidak pasti" };

function yesNo(yesRoute: Route, noRoute: Route, notes: { yes?: string; no?: string } = {}): QuestionOption[] {
  return [
    { value: "no", label: NO, route: noRoute, note: notes.no },
    { value: "yes", label: YES, route: yesRoute, note: notes.yes },
  ];
}

/**
 * Asked last in every set, after the patient has been told what happens next.
 * "Not sure" or "No" means a nurse calls to explain.
 */
export const CONFIDENCE_QUESTION: Question = {
  id: "next_steps",
  text: { en: "Do you know what to do next?", ms: "Adakah anda tahu apa yang perlu dilakukan seterusnya?" },
  options: [
    { value: "yes", label: YES, route: "green", note: "knows next step" },
    { value: "not_sure", label: NOT_SURE, route: "amber", note: "unsure of next step" },
    { value: "no", label: NO, route: "amber", note: "unsure of next step" },
  ],
};

export const PROTOCOLS: Protocol[] = [
  {
    code: "adult_fever",
    version: 2,
    label: "Adult fever (dengue watch)",
    subject: "self",
    summary: "Fever without a confirmed cause, where dengue is possible.",
    defaultCheckInHours: 48,
    timingNote:
      "Dengue warning signs tend to appear around days 3 to 7 of the fever, often as the fever settles. Time the check-in for that window.",
    signs: [
      { id: "abdominal_pain", label: "Severe abdominal pain" },
      { id: "bleeding", label: "Rash or bleeding (gums, nose)" },
      { id: "low_urine", label: "Passing little urine" },
      { id: "drowsy", label: "Drowsy, restless or confused" },
    ],
    causes: [
      { id: "viral", label: "Viral fever", defaultLevel: "likely" },
      { id: "dengue", label: "Dengue", defaultLevel: "watch" },
      { id: "gastro", label: "Gastroenteritis", defaultLevel: "possible" },
      { id: "uti", label: "Urinary infection", defaultLevel: "possible" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "amber" },
    questions: [
      {
        id: "fluids",
        text: {
          en: "Can you drink and keep fluids down?",
          ms: "Bolehkah anda minum tanpa memuntahkannya?",
        },
        options: [
          { value: "yes", label: YES, route: "green", note: "drinking well" },
          { value: "some_vomiting", label: { en: "Some vomiting", ms: "Muntah sedikit" }, route: "amber", note: "some vomiting" },
          { value: "cannot", label: { en: "Can't keep fluids", ms: "Tak boleh minum" }, route: "red", note: "can't keep fluids down" },
        ],
        tests: { gastro: { some_vomiting: "raises" } },
      },
      {
        id: "rash_bleeding",
        sign: "bleeding",
        text: {
          en: "Any red rash on your skin, or bleeding from your gums or nose?",
          ms: "Ada ruam merah pada kulit, atau gusi atau hidung berdarah?",
        },
        options: [
          { value: "none", label: { en: "None", ms: "Tiada" }, route: "green" },
          { value: "rash", label: { en: "Rash", ms: "Ada ruam" }, route: "amber", note: "new rash" },
          { value: "bleeding", label: { en: "Bleeding", ms: "Berdarah" }, route: "red", note: "bleeding" },
        ],
        tests: { dengue: { rash: "raises", bleeding: "raises" } },
      },
      {
        id: "abdominal_pain",
        sign: "abdominal_pain",
        text: { en: "Do you have severe stomach pain?", ms: "Adakah anda sakit perut yang teruk?" },
        options: yesNo("red", "green", { yes: "severe stomach pain" }),
        tests: { dengue: { yes: "raises" } },
      },
      {
        id: "urine",
        sign: "low_urine",
        text: {
          en: "Have you passed urine in the last 6 hours?",
          ms: "Adakah anda sudah kencing dalam 6 jam yang lalu?",
        },
        options: yesNo("green", "red", { no: "no urine for 6 h" }),
      },
      {
        id: "drowsy",
        sign: "drowsy",
        text: {
          en: "Are you unusually sleepy, restless or confused?",
          ms: "Adakah anda luar biasa mengantuk, gelisah atau keliru?",
        },
        options: yesNo("red", "green", { yes: "drowsy or confused" }),
      },
      {
        id: "tummy",
        text: {
          en: "How is your tummy today? Any diarrhoea or vomiting?",
          ms: "Bagaimana perut anda hari ini? Ada cirit-birit atau muntah?",
        },
        options: [
          { value: "ok", label: { en: "Tummy OK", ms: "Perut OK" }, route: "green", note: "tummy fine" },
          { value: "diarrhoea", label: { en: "Diarrhoea", ms: "Cirit-birit" }, route: "amber", note: "diarrhoea" },
          { value: "vomiting", label: { en: "Vomiting", ms: "Muntah" }, route: "amber", note: "vomiting" },
        ],
        tests: { gastro: { ok: "rules_out", diarrhoea: "raises", vomiting: "raises" } },
      },
      {
        id: "fever_trend",
        text: { en: "Is the fever coming down?", ms: "Adakah demam anda semakin berkurang?" },
        options: [
          { value: "gone", label: { en: "It's gone", ms: "Sudah hilang" }, route: "green", note: "no fever now" },
          { value: "down", label: { en: "Coming down", ms: "Semakin kurang" }, route: "green", note: "fever coming down" },
          { value: "not_yet", label: { en: "Not yet", ms: "Belum lagi" }, route: "amber", note: "fever not settling" },
        ],
        tests: { viral: { gone: "raises", down: "raises" } },
      },
      {
        id: "urine_pain",
        text: {
          en: "Any pain or burning when you pass urine?",
          ms: "Adakah anda rasa sakit atau pedih semasa kencing?",
        },
        options: yesNo("amber", "green", { yes: "pain passing urine" }),
        tests: { uti: { yes: "raises", no: "rules_out" } },
      },
    ],
  },
  {
    code: "child_fever",
    version: 2,
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
    causes: [
      { id: "viral", label: "Viral illness", defaultLevel: "likely" },
      { id: "gastro", label: "Gastroenteritis", defaultLevel: "watch" },
      { id: "chest", label: "Chest infection", defaultLevel: "possible" },
      { id: "uti", label: "Urinary infection", defaultLevel: "possible" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "amber" },
    questions: [
      {
        id: "drinking",
        text: { en: "Is your child drinking?", ms: "Adakah anak anda minum?" },
        options: [
          { value: "well", label: { en: "Drinking well", ms: "Minum seperti biasa" }, route: "green", note: "drinking well" },
          { value: "less", label: { en: "Less than usual", ms: "Kurang dari biasa" }, route: "amber", note: "drinking less" },
          { value: "not", label: { en: "Not drinking", ms: "Tidak minum" }, route: "red", note: "not drinking" },
        ],
      },
      {
        id: "vomiting",
        text: { en: "Is your child still vomiting?", ms: "Adakah anak anda masih muntah?" },
        options: [
          { value: "no", label: NO, route: "green" },
          { value: "sometimes", label: { en: "Sometimes", ms: "Kadang-kadang" }, route: "amber", note: "some vomiting" },
          { value: "keeps", label: { en: "Keeps vomiting", ms: "Muntah berterusan" }, route: "red", note: "keeps vomiting" },
        ],
        tests: { gastro: { sometimes: "raises", keeps: "raises" } },
      },
      {
        id: "wet",
        sign: "low_urine",
        text: {
          en: "Has your child passed urine or had a wet nappy in the last 8 hours?",
          ms: "Adakah anak anda kencing atau lampinnya basah dalam 8 jam yang lalu?",
        },
        options: yesNo("green", "red", { no: "no wet nappy for 8 h" }),
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
          { value: "sleepier", label: { en: "Sleepier than usual", ms: "Lebih mengantuk" }, route: "amber", note: "sleepier than usual" },
          { value: "hard_to_wake", label: { en: "Hard to wake", ms: "Susah dikejutkan" }, route: "red", note: "hard to wake" },
        ],
      },
      {
        id: "breathing",
        sign: "breathing",
        text: {
          en: "Is your child breathing fast or working hard to breathe?",
          ms: "Adakah anak anda bernafas laju atau susah bernafas?",
        },
        options: yesNo("red", "green", { yes: "fast or hard breathing" }),
        tests: { chest: { yes: "raises" } },
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
          { value: "yes", label: YES, route: "red", note: "non-fading rash" },
          { value: "not_sure", label: NOT_SURE, route: "amber", note: "possible rash" },
        ],
      },
      {
        id: "diarrhoea",
        text: { en: "Does your child have diarrhoea?", ms: "Adakah anak anda cirit-birit?" },
        options: yesNo("amber", "green", { yes: "diarrhoea" }),
        tests: { gastro: { yes: "raises", no: "rules_out" } },
      },
      {
        id: "cough",
        text: {
          en: "Does your child have a cough or runny nose?",
          ms: "Adakah anak anda batuk atau selsema?",
        },
        options: yesNo("green", "green", { yes: "cough or runny nose" }),
        tests: { viral: { yes: "raises" }, chest: { no: "rules_out" } },
      },
      {
        id: "urine_pain",
        text: {
          en: "Does your child cry or complain when passing urine?",
          ms: "Adakah anak anda menangis atau mengadu sakit semasa kencing?",
        },
        options: yesNo("amber", "green", { yes: "pain passing urine" }),
        tests: { uti: { yes: "raises", no: "rules_out" } },
      },
    ],
  },
  {
    code: "abdominal_pain",
    version: 2,
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
    causes: [
      { id: "gastro", label: "Gastroenteritis", defaultLevel: "likely" },
      { id: "appendicitis", label: "Appendicitis", defaultLevel: "watch" },
      { id: "uti", label: "Urinary infection", defaultLevel: "possible" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "red" },
    questions: [
      {
        id: "pain_now",
        text: { en: "How is the pain now?", ms: "Bagaimana sakit anda sekarang?" },
        options: [
          { value: "better", label: { en: "Gone or better", ms: "Hilang/berkurang" }, route: "green", note: "pain easing" },
          { value: "same", label: { en: "About the same", ms: "Lebih kurang sama" }, route: "amber", note: "pain unchanged" },
          { value: "worse", label: { en: "Worse", ms: "Lebih teruk" }, route: "red", note: "pain worse" },
        ],
      },
      {
        id: "pain_moved",
        sign: "pain_moved",
        text: {
          en: "Has the pain moved to the lower right side of your belly?",
          ms: "Adakah sakit beralih ke bahagian kanan bawah perut anda?",
        },
        options: yesNo("red", "green", { yes: "pain moved to lower right" }),
        tests: { appendicitis: { yes: "raises" } },
      },
      {
        id: "movement",
        sign: "movement",
        text: {
          en: "Does walking or coughing make the pain worse?",
          ms: "Adakah berjalan atau batuk menambah sakit?",
        },
        options: yesNo("amber", "green", { yes: "pain worse on walking" }),
        tests: { appendicitis: { yes: "raises" } },
      },
      {
        id: "fever",
        sign: "fever",
        text: { en: "Do you have a fever?", ms: "Adakah anda demam?" },
        options: yesNo("amber", "green", { yes: "fever" }),
        tests: { appendicitis: { yes: "raises" } },
      },
      {
        id: "vomiting",
        sign: "vomiting",
        text: {
          en: "Are you vomiting or unable to eat?",
          ms: "Adakah anda muntah atau tidak boleh makan?",
        },
        options: yesNo("amber", "green", { yes: "vomiting or not eating" }),
        tests: { gastro: { yes: "raises" } },
      },
      {
        id: "diarrhoea",
        text: { en: "Do you have diarrhoea?", ms: "Adakah anda cirit-birit?" },
        options: yesNo("green", "green", { yes: "diarrhoea" }),
        tests: { gastro: { yes: "raises", no: "rules_out" } },
      },
      {
        id: "urine_pain",
        text: {
          en: "Any pain or burning when you pass urine?",
          ms: "Adakah anda rasa sakit atau pedih semasa kencing?",
        },
        options: yesNo("amber", "green", { yes: "pain passing urine" }),
        tests: { uti: { yes: "raises", no: "rules_out" } },
      },
    ],
  },
  {
    code: "head_injury",
    version: 2,
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
    causes: [
      { id: "minor", label: "Minor head injury / tension headache", defaultLevel: "likely" },
      { id: "concussion", label: "Concussion", defaultLevel: "watch" },
      { id: "bleed", label: "Bleeding inside the skull", defaultLevel: "possible" },
    ],
    openerRoutes: { better: "green", same: "amber", worse: "red" },
    questions: [
      {
        id: "headache",
        text: { en: "How is the headache now?", ms: "Bagaimana sakit kepala anda sekarang?" },
        options: [
          { value: "easing", label: { en: "Gone or easing", ms: "Hilang/berkurang" }, route: "green", note: "headache easing" },
          { value: "same", label: { en: "About the same", ms: "Lebih kurang sama" }, route: "amber", note: "headache unchanged" },
          { value: "worse", label: { en: "Getting worse", ms: "Semakin teruk" }, route: "red", note: "headache worse" },
        ],
        tests: { minor: { easing: "raises" } },
      },
      {
        id: "vomiting",
        sign: "vomiting",
        text: {
          en: "Have you vomited more than once?",
          ms: "Adakah anda muntah lebih daripada sekali?",
        },
        options: yesNo("red", "green", { yes: "repeated vomiting" }),
        tests: { bleed: { yes: "raises" } },
      },
      {
        id: "confusion",
        sign: "confusion",
        text: {
          en: "Any confusion, unusual drowsiness or trouble speaking?",
          ms: "Adakah anda keliru, luar biasa mengantuk atau susah bercakap?",
        },
        options: yesNo("red", "green", { yes: "confused or drowsy" }),
        tests: { bleed: { yes: "raises" }, concussion: { yes: "raises" } },
      },
      {
        id: "neuro",
        sign: "neuro",
        text: {
          en: "Any new weakness, numbness or problems with your vision?",
          ms: "Adakah anda rasa lemah, kebas atau penglihatan terganggu?",
        },
        options: yesNo("red", "green", { yes: "weakness or vision problems" }),
        tests: { bleed: { yes: "raises" } },
      },
      {
        id: "concentration",
        text: {
          en: "Any trouble concentrating, or feeling dizzy?",
          ms: "Adakah anda susah menumpukan perhatian atau rasa pening?",
        },
        options: yesNo("amber", "green", { yes: "dizzy or poor concentration" }),
        tests: { concussion: { yes: "raises", no: "rules_out" } },
      },
    ],
  },
];

export function getProtocol(code: string) {
  return PROTOCOLS.find((protocol) => protocol.code === code) ?? null;
}

/**
 * The pool of questions for this follow-up, in protocol order: every question
 * without a sign, plus the questions for the warning signs the doctor chose.
 * The closing question is asked separately.
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
  if (questionId === CONFIDENCE_QUESTION.id) return CONFIDENCE_QUESTION;
  return protocol.questions.find((question) => question.id === questionId) ?? null;
}

/** A question is a red-flag question when any of its answers routes red. These are always asked, first. */
export function isRedFlagQuestion(question: Question) {
  return question.options.some((option) => option.route === "red");
}

export const OPENER_LABELS: Record<OpenerValue, Localized> = {
  better: { en: "Better", ms: "Lebih baik" },
  same: { en: "Same", ms: "Sama" },
  worse: { en: "Worse", ms: "Lebih teruk" },
};

export const OPENER_NOTES: Record<OpenerValue, string> = {
  better: "feeling better",
  same: "no change",
  worse: "feeling worse",
};
