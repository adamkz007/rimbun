// Screening and diagnostic tests a general clinic sees day to day, with the
// default rules that flag a result for follow-up. Thresholds are starting
// defaults for a simulated pilot; the clinical lead should confirm them before
// real use. A doctor always confirms the flag (rules never open a case alone).

export const URGENCIES = ["routine", "soon", "urgent", "critical"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const PATIENT_LANGUAGES = ["en", "ms"] as const;
export type PatientLanguage = (typeof PATIENT_LANGUAGES)[number];

export type NextStep = "clinic_review" | "repeat_test" | "referral" | "same_day_review";

export type TestCategory = "routine" | "cancer" | "fever" | "older_adult" | "infection";

export const TEST_CATEGORY_LABELS: Record<TestCategory, string> = {
  routine: "Routine health check",
  cancer: "Cancer screening",
  fever: "Fever triage",
  older_adult: "Older adults",
  infection: "Infection screening",
};

type Localized = Record<PatientLanguage, string>;

type NumericBand = { min?: number; max?: number; urgency: Urgency | null };

type NumericTest = {
  kind: "numeric";
  unit: string;
  /** Bands are checked in order; the first match wins. `null` = normal. */
  bands: NumericBand[];
};

type ChoiceTest = {
  kind: "choice";
  options: Array<{ value: string; label: string; urgency: Urgency | null }>;
};

type BloodPressureTest = { kind: "blood_pressure"; unit: "mmHg" };

export type TestDefinition = {
  code: string;
  label: string;
  category: TestCategory;
  nextStep: NextStep;
  referralSpecialty?: string;
  /** What the test checks, in plain words. */
  about: Localized;
  /** What an abnormal result means, without numbers. */
  meaning: Localized;
} & (NumericTest | ChoiceTest | BloodPressureTest);

export const TEST_CATALOGUE: TestDefinition[] = [
  {
    code: "hba1c",
    label: "HbA1c",
    category: "routine",
    kind: "numeric",
    unit: "%",
    bands: [
      { min: 10, urgency: "urgent" },
      { min: 6.3, urgency: "soon" },
      { min: 5.7, urgency: "routine" },
      { urgency: null },
    ],
    nextStep: "clinic_review",
    about: {
      en: "your average blood sugar over the last 2 to 3 months",
      ms: "purata gula dalam darah anda sepanjang 2 hingga 3 bulan lepas",
    },
    meaning: {
      en: "Your blood sugar is higher than it should be. This can be a sign of diabetes or pre-diabetes, which is very treatable when caught early.",
      ms: "Gula dalam darah anda lebih tinggi daripada biasa. Ini mungkin tanda diabetes atau pra-diabetes, yang boleh dirawat dengan baik jika dikesan awal.",
    },
  },
  {
    code: "fasting_glucose",
    label: "Fasting blood glucose",
    category: "routine",
    kind: "numeric",
    unit: "mmol/L",
    bands: [
      { min: 16.7, urgency: "urgent" },
      { min: 7.0, urgency: "soon" },
      { min: 6.1, urgency: "routine" },
      { max: 3.0, urgency: "urgent" },
      { urgency: null },
    ],
    nextStep: "clinic_review",
    about: {
      en: "your blood sugar after not eating overnight",
      ms: "gula dalam darah anda selepas berpuasa semalaman",
    },
    meaning: {
      en: "Your blood sugar is outside the healthy range. The doctor would like to review it with you and plan the next step.",
      ms: "Gula dalam darah anda di luar julat sihat. Doktor ingin menyemaknya bersama anda dan merancang langkah seterusnya.",
    },
  },
  {
    code: "ldl",
    label: "LDL cholesterol",
    category: "routine",
    kind: "numeric",
    unit: "mmol/L",
    bands: [
      { min: 4.9, urgency: "soon" },
      { min: 3.4, urgency: "routine" },
      { urgency: null },
    ],
    nextStep: "clinic_review",
    about: {
      en: "the 'bad' cholesterol in your blood",
      ms: "kolesterol 'jahat' dalam darah anda",
    },
    meaning: {
      en: "Your cholesterol is higher than recommended. Over time this raises the risk of heart disease and stroke, and it can be lowered.",
      ms: "Kolesterol anda lebih tinggi daripada yang disyorkan. Lama-kelamaan ini meningkatkan risiko penyakit jantung dan strok, dan ia boleh diturunkan.",
    },
  },
  {
    code: "blood_pressure",
    label: "Blood pressure",
    category: "routine",
    kind: "blood_pressure",
    unit: "mmHg",
    nextStep: "clinic_review",
    about: {
      en: "the pressure of blood in your arteries",
      ms: "tekanan darah dalam saluran darah anda",
    },
    meaning: {
      en: "Your blood pressure reading was high. High blood pressure often has no symptoms, so a check and a plan are important.",
      ms: "Bacaan tekanan darah anda tinggi. Tekanan darah tinggi selalunya tiada gejala, jadi pemeriksaan dan rancangan rawatan adalah penting.",
    },
  },
  {
    code: "egfr",
    label: "Kidney function (eGFR)",
    category: "older_adult",
    kind: "numeric",
    unit: "mL/min/1.73m²",
    bands: [
      { max: 15, urgency: "urgent" },
      { max: 30, urgency: "soon" },
      { max: 60, urgency: "routine" },
      { urgency: null },
    ],
    nextStep: "clinic_review",
    referralSpecialty: "Nephrology",
    about: {
      en: "how well your kidneys are filtering your blood",
      ms: "sejauh mana buah pinggang anda menapis darah",
    },
    meaning: {
      en: "Your kidneys are working less well than expected. The doctor would like to check your medicines and plan follow-up.",
      ms: "Buah pinggang anda berfungsi kurang baik daripada jangkaan. Doktor ingin menyemak ubat-ubatan anda dan merancang susulan.",
    },
  },
  {
    code: "potassium",
    label: "Potassium",
    category: "older_adult",
    kind: "numeric",
    unit: "mmol/L",
    bands: [
      { min: 6.0, urgency: "critical" },
      { min: 5.5, urgency: "urgent" },
      { max: 2.9, urgency: "urgent" },
      { max: 3.4, urgency: "soon" },
      { urgency: null },
    ],
    nextStep: "same_day_review",
    about: {
      en: "a salt in your blood that keeps your heart rhythm steady",
      ms: "sejenis garam dalam darah yang memastikan rentak jantung anda stabil",
    },
    meaning: {
      en: "A salt level in your blood is outside the safe range. This can affect your heart, so the clinic needs to see you soon.",
      ms: "Paras garam dalam darah anda di luar julat selamat. Ini boleh menjejaskan jantung anda, jadi klinik perlu berjumpa anda segera.",
    },
  },
  {
    code: "haemoglobin",
    label: "Haemoglobin",
    category: "older_adult",
    kind: "numeric",
    unit: "g/dL",
    bands: [
      { max: 7, urgency: "urgent" },
      { max: 10, urgency: "soon" },
      { max: 12, urgency: "routine" },
      { urgency: null },
    ],
    nextStep: "clinic_review",
    about: {
      en: "the part of your blood that carries oxygen",
      ms: "bahagian darah yang membawa oksigen",
    },
    meaning: {
      en: "Your blood count is low (anaemia). The doctor would like to find the cause and treat it.",
      ms: "Bacaan darah anda rendah (anemia). Doktor ingin mencari puncanya dan merawatnya.",
    },
  },
  {
    code: "alt",
    label: "Liver enzyme (ALT)",
    category: "routine",
    kind: "numeric",
    unit: "U/L",
    bands: [
      { min: 200, urgency: "soon" },
      { min: 45, urgency: "routine" },
      { urgency: null },
    ],
    nextStep: "repeat_test",
    about: {
      en: "how your liver is coping",
      ms: "keadaan hati anda",
    },
    meaning: {
      en: "A liver test is raised. This is often mild, but the doctor would like to repeat it and look for the cause.",
      ms: "Ujian hati anda meningkat. Ia selalunya ringan, tetapi doktor ingin mengulanginya dan mencari puncanya.",
    },
  },
  {
    code: "fit",
    label: "Stool test for colorectal cancer (FIT)",
    category: "cancer",
    kind: "choice",
    options: [
      { value: "negative", label: "Negative", urgency: null },
      { value: "positive", label: "Positive", urgency: "soon" },
    ],
    nextStep: "referral",
    referralSpecialty: "Gastroenterology / colonoscopy",
    about: {
      en: "hidden blood in your stool, an early check for bowel problems",
      ms: "darah tersembunyi dalam najis anda, pemeriksaan awal masalah usus",
    },
    meaning: {
      en: "The test found traces of blood. Most people with this result do not have cancer, but you need a camera test of the bowel (colonoscopy) to be sure.",
      ms: "Ujian ini menemui kesan darah. Kebanyakan orang dengan keputusan ini tidak menghidap kanser, tetapi anda perlu menjalani ujian kamera usus (kolonoskopi) untuk kepastian.",
    },
  },
  {
    code: "cervical",
    label: "Cervical screening (HPV / Pap)",
    category: "cancer",
    kind: "choice",
    options: [
      { value: "negative", label: "Negative", urgency: null },
      { value: "hpv_positive", label: "HPV positive, normal cells", urgency: "routine" },
      { value: "low_grade", label: "Low-grade changes", urgency: "soon" },
      { value: "high_grade", label: "High-grade changes", urgency: "urgent" },
    ],
    nextStep: "referral",
    referralSpecialty: "Gynaecology / colposcopy",
    about: {
      en: "the cells of your cervix, to prevent cervical cancer",
      ms: "sel-sel serviks anda, untuk mencegah kanser serviks",
    },
    meaning: {
      en: "Your screening found changes that need a closer look. Changes like these are usually treated easily before they become a problem.",
      ms: "Saringan anda menemui perubahan yang perlu diperiksa dengan lebih teliti. Perubahan seperti ini biasanya mudah dirawat sebelum menjadi masalah.",
    },
  },
  {
    code: "mammogram",
    label: "Mammogram (BI-RADS)",
    category: "cancer",
    kind: "choice",
    options: [
      { value: "1", label: "BI-RADS 1 (negative)", urgency: null },
      { value: "2", label: "BI-RADS 2 (benign)", urgency: null },
      { value: "0", label: "BI-RADS 0 (needs more imaging)", urgency: "soon" },
      { value: "3", label: "BI-RADS 3 (probably benign)", urgency: "routine" },
      { value: "4", label: "BI-RADS 4 (suspicious)", urgency: "urgent" },
      { value: "5", label: "BI-RADS 5 (highly suspicious)", urgency: "urgent" },
    ],
    nextStep: "referral",
    referralSpecialty: "Breast surgery",
    about: {
      en: "your breast tissue, using an X-ray",
      ms: "tisu payudara anda, menggunakan X-ray",
    },
    meaning: {
      en: "Your mammogram needs further checks. Many findings turn out to be harmless, and checking early gives the best outcome.",
      ms: "Mamogram anda memerlukan pemeriksaan lanjut. Banyak penemuan ternyata tidak berbahaya, dan pemeriksaan awal memberi hasil terbaik.",
    },
  },
  {
    code: "psa",
    label: "PSA (prostate)",
    category: "cancer",
    kind: "numeric",
    unit: "ng/mL",
    bands: [
      { min: 10, urgency: "soon" },
      { min: 4, urgency: "routine" },
      { urgency: null },
    ],
    nextStep: "repeat_test",
    referralSpecialty: "Urology",
    about: {
      en: "a protein made by the prostate",
      ms: "sejenis protein yang dihasilkan oleh prostat",
    },
    meaning: {
      en: "Your PSA level is raised. This has many causes, most of them not cancer. The doctor will plan a repeat test or a specialist review.",
      ms: "Paras PSA anda meningkat. Ia mempunyai banyak punca, kebanyakannya bukan kanser. Doktor akan merancang ujian ulangan atau rujukan pakar.",
    },
  },
  {
    code: "dengue_ns1",
    label: "Dengue NS1 antigen",
    category: "fever",
    kind: "choice",
    options: [
      { value: "negative", label: "Negative", urgency: null },
      { value: "positive", label: "Positive", urgency: "urgent" },
    ],
    nextStep: "same_day_review",
    about: {
      en: "whether your fever is caused by dengue",
      ms: "sama ada demam anda disebabkan oleh denggi",
    },
    meaning: {
      en: "Your test shows dengue. Dengue needs close monitoring of your blood count and fluids over the next few days.",
      ms: "Ujian anda menunjukkan denggi. Denggi memerlukan pemantauan rapi bacaan darah dan cecair badan anda dalam beberapa hari akan datang.",
    },
  },
  {
    code: "platelets",
    label: "Platelet count",
    category: "fever",
    kind: "numeric",
    unit: "×10⁹/L",
    bands: [
      { max: 20, urgency: "critical" },
      { max: 100, urgency: "urgent" },
      { max: 150, urgency: "soon" },
      { urgency: null },
    ],
    nextStep: "same_day_review",
    about: {
      en: "the cells that help your blood clot",
      ms: "sel-sel yang membantu darah anda membeku",
    },
    meaning: {
      en: "Your platelets are low. During a fever, especially dengue, this needs to be checked again quickly.",
      ms: "Platelet anda rendah. Semasa demam, terutamanya denggi, ini perlu diperiksa semula dengan segera.",
    },
  },
  {
    code: "crp",
    label: "C-reactive protein (CRP)",
    category: "fever",
    kind: "numeric",
    unit: "mg/L",
    bands: [
      { min: 100, urgency: "urgent" },
      { min: 40, urgency: "soon" },
      { urgency: null },
    ],
    nextStep: "same_day_review",
    about: {
      en: "inflammation or infection in your body",
      ms: "keradangan atau jangkitan dalam badan anda",
    },
    meaning: {
      en: "Your test shows significant inflammation, which may mean an infection that needs treatment.",
      ms: "Ujian anda menunjukkan keradangan yang ketara, yang mungkin bermaksud jangkitan yang memerlukan rawatan.",
    },
  },
  {
    code: "hbsag",
    label: "Hepatitis B surface antigen",
    category: "infection",
    kind: "choice",
    options: [
      { value: "negative", label: "Negative", urgency: null },
      { value: "positive", label: "Positive", urgency: "soon" },
    ],
    nextStep: "clinic_review",
    referralSpecialty: "Gastroenterology / hepatology",
    about: {
      en: "hepatitis B, a virus that affects the liver",
      ms: "hepatitis B, sejenis virus yang menjejaskan hati",
    },
    meaning: {
      en: "Your test shows hepatitis B. Many people live well with it when it is monitored, and your family may be offered testing.",
      ms: "Ujian anda menunjukkan hepatitis B. Ramai orang hidup sihat dengannya jika dipantau, dan keluarga anda mungkin ditawarkan ujian.",
    },
  },
  {
    code: "ecg",
    label: "ECG",
    category: "older_adult",
    kind: "choice",
    options: [
      { value: "normal", label: "Normal", urgency: null },
      { value: "non_specific", label: "Non-specific changes", urgency: "routine" },
      { value: "abnormal", label: "Abnormal (e.g. new AF)", urgency: "soon" },
      { value: "acute", label: "Acute changes", urgency: "critical" },
    ],
    nextStep: "clinic_review",
    referralSpecialty: "Cardiology",
    about: {
      en: "the electrical rhythm of your heart",
      ms: "rentak elektrik jantung anda",
    },
    meaning: {
      en: "Your heart tracing showed changes the doctor wants to look at more closely.",
      ms: "Rakaman jantung anda menunjukkan perubahan yang doktor ingin periksa dengan lebih teliti.",
    },
  },
];

const TESTS_BY_CODE = new Map(TEST_CATALOGUE.map((test) => [test.code, test]));

export function getTest(code: string) {
  return TESTS_BY_CODE.get(code) ?? null;
}

export type ResultValue = { numeric?: number | null; text?: string | null };

/** Parses "150/95" (or "150 / 95") into systolic and diastolic values. */
export function parseBloodPressure(text: string | null | undefined) {
  const match = text?.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

function bloodPressureUrgency(text: string | null | undefined): Urgency | null {
  const bp = parseBloodPressure(text);
  if (!bp) return null;
  if (bp.systolic >= 180 || bp.diastolic >= 120) return "urgent";
  if (bp.systolic >= 160 || bp.diastolic >= 100) return "soon";
  if (bp.systolic >= 140 || bp.diastolic >= 90) return "routine";
  return null;
}

function matchesBand(band: NumericBand, value: number) {
  if (band.min !== undefined && value < band.min) return false;
  if (band.max !== undefined && value > band.max) return false;
  return true;
}

/**
 * Suggested urgency for a result under the default rules, or `null` when the
 * result is within the normal range. Unknown tests and unreadable values return
 * `null` and are left for the doctor to triage by hand.
 */
export function suggestUrgency(code: string, value: ResultValue): Urgency | null {
  const test = getTest(code);
  if (!test) return null;

  if (test.kind === "blood_pressure") {
    return bloodPressureUrgency(value.text);
  }

  if (test.kind === "choice") {
    return test.options.find((option) => option.value === value.text)?.urgency ?? null;
  }

  if (value.numeric === null || value.numeric === undefined || Number.isNaN(value.numeric)) {
    return null;
  }

  const numeric = value.numeric;
  return test.bands.find((band) => matchesBand(band, numeric))?.urgency ?? null;
}

export function formatResultValue(code: string, value: ResultValue) {
  const test = getTest(code);
  if (!test) return value.text ?? (value.numeric != null ? String(value.numeric) : "");

  if (test.kind === "choice") {
    return test.options.find((option) => option.value === value.text)?.label ?? value.text ?? "";
  }

  if (test.kind === "blood_pressure") {
    return value.text ? `${value.text} ${test.unit}` : "";
  }

  return value.numeric != null ? `${value.numeric} ${test.unit}` : "";
}

export function compareUrgency(left: Urgency, right: Urgency) {
  return URGENCIES.indexOf(left) - URGENCIES.indexOf(right);
}

export const URGENCY_LABELS: Record<Urgency, string> = {
  routine: "Routine",
  soon: "Soon",
  urgent: "Urgent",
  critical: "Critical",
};

export const NEXT_STEP_LABELS: Record<NextStep, Localized> = {
  clinic_review: {
    en: "Book a review with your doctor at the clinic",
    ms: "Buat temujanji semakan dengan doktor anda di klinik",
  },
  repeat_test: {
    en: "Come back to the clinic for a repeat test",
    ms: "Datang semula ke klinik untuk ujian ulangan",
  },
  referral: {
    en: "See a specialist; the clinic will arrange the referral",
    ms: "Berjumpa pakar; klinik akan menguruskan rujukan",
  },
  same_day_review: {
    en: "Come back to the clinic today, or go to the nearest emergency department if you feel worse",
    ms: "Datang semula ke klinik hari ini, atau pergi ke jabatan kecemasan terdekat jika anda berasa lebih teruk",
  },
};
