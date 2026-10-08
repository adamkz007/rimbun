import type { RegionId } from "./anatomy.ts";
import type { DiagnoseAnswers, Option } from "./questions.ts";

// Deterministic emergency screen. These rules run in the browser and again on
// the server, before any AI call, and never depend on the model.

export const NO_RED_FLAGS = "none";

type RedFlag = Option & { reason: string };

const GENERAL_FLAGS: RedFlag[] = [
  { value: "fainted", label: "Fainted or nearly fainted", reason: "Fainting with pain can signal a serious problem." },
  { value: "confusion", label: "New confusion or very drowsy", reason: "New confusion needs urgent assessment." },
  { value: "severe_bleeding", label: "Heavy bleeding", reason: "Heavy bleeding needs emergency care." },
];

const REGION_FLAGS: Partial<Record<RegionId, RedFlag[]>> = {
  head: [
    { value: "thunderclap", label: "Sudden, worst headache of my life", reason: "A sudden severe headache can be bleeding in the brain." },
    { value: "face_droop", label: "Face drooping, arm weakness or slurred speech", reason: "These are signs of a stroke (think FAST)." },
    { value: "fever_stiff_neck_rash", label: "Fever with a stiff neck or a rash that doesn't fade", reason: "This can be meningitis." },
    { value: "head_injury_vomiting", label: "Head injury with vomiting or drowsiness", reason: "This can mean a brain injury." },
  ],
  neck: [
    { value: "cant_swallow_saliva", label: "Can't swallow saliva / drooling", reason: "A blocked throat is an emergency." },
    { value: "noisy_breathing", label: "Noisy or difficult breathing", reason: "Breathing difficulty is an emergency." },
  ],
  chest: [
    { value: "crushing_radiating", label: "Crushing pain spreading to arm, jaw or back", reason: "This can be a heart attack." },
    { value: "chest_sweating_breathless", label: "Chest pain with sweating or breathlessness", reason: "This can be a heart attack or a clot in the lung." },
    { value: "tearing_back", label: "Sudden tearing pain going through to the back", reason: "This can be a tear in the main artery (aorta)." },
    { value: "coughing_blood", label: "Coughing up blood", reason: "Coughing up blood needs urgent assessment." },
  ],
  abdomen: [
    { value: "rigid_abdomen", label: "Belly is rigid, or it hurts to move at all", reason: "This can mean inflammation of the abdominal lining (peritonitis)." },
    { value: "vomiting_blood", label: "Vomiting blood or 'coffee grounds'", reason: "This can be bleeding in the gut." },
    { value: "black_stool", label: "Black, tarry or bloody stools", reason: "This can be bleeding in the gut." },
    { value: "pregnant_pain", label: "Pregnant (or might be) with belly pain or bleeding", reason: "This can be an ectopic pregnancy." },
  ],
  back: [
    { value: "saddle_numbness", label: "Numb between the legs, or can't control bladder/bowel", reason: "This can be cauda equina syndrome, a spinal emergency." },
    { value: "legs_weak", label: "Both legs getting weak", reason: "Progressive leg weakness needs urgent assessment." },
    { value: "tearing_back", label: "Sudden tearing pain in the back", reason: "This can be a tear in the main artery (aorta)." },
  ],
  pelvis: [
    { value: "testicle_sudden", label: "Sudden severe testicle pain", reason: "This can be testicular torsion, which needs surgery within hours." },
    { value: "pregnant_pain", label: "Pregnant (or might be) with pain or bleeding", reason: "This can be an ectopic pregnancy." },
    { value: "cant_pass_urine", label: "Can't pass urine at all", reason: "Urinary retention needs urgent care." },
  ],
  shoulder: [
    { value: "crushing_radiating", label: "Pain with chest tightness or breathlessness", reason: "Shoulder or arm pain can come from the heart." },
    { value: "deformed", label: "Joint looks deformed after an injury", reason: "This can be a dislocation or fracture." },
  ],
  arm: [
    { value: "crushing_radiating", label: "Arm pain with chest tightness or sweating", reason: "Arm pain can come from the heart." },
    { value: "deformed", label: "Limb looks deformed after an injury", reason: "This can be a fracture." },
    { value: "cold_pale", label: "Limb is cold, pale or numb", reason: "This can mean the blood supply is blocked." },
  ],
  hand: [
    { value: "deformed", label: "Looks deformed after an injury", reason: "This can be a fracture or dislocation." },
    { value: "cold_pale", label: "Fingers cold, pale or blue", reason: "This can mean the blood supply is blocked." },
    { value: "spreading_redness", label: "Rapidly spreading redness with fever", reason: "This can be a serious infection." },
  ],
  hip: [
    { value: "fall_cant_bear_weight", label: "Fell and can't stand on it", reason: "This can be a hip fracture." },
    { value: "hot_joint_fever", label: "Hot, swollen joint with fever", reason: "This can be an infected joint." },
  ],
  knee: [
    { value: "hot_joint_fever", label: "Hot, swollen joint with fever", reason: "This can be an infected joint." },
    { value: "deformed", label: "Looks deformed after an injury", reason: "This can be a fracture or dislocation." },
  ],
  lower_leg: [
    { value: "calf_swollen_breathless", label: "Swollen calf with chest pain or breathlessness", reason: "This can be a clot that has travelled to the lung." },
    { value: "cold_pale", label: "Leg cold, pale or numb", reason: "This can mean the blood supply is blocked." },
    { value: "deformed", label: "Looks deformed after an injury", reason: "This can be a fracture." },
  ],
  foot: [
    { value: "cold_pale", label: "Foot cold, pale or blue", reason: "This can mean the blood supply is blocked." },
    { value: "diabetic_wound", label: "Diabetic with a wound, black skin or spreading redness", reason: "Diabetic foot infections can become serious quickly." },
  ],
};

export function getRedFlagOptions(region: RegionId | null): RedFlag[] {
  const seen = new Set<string>();
  return [...((region && REGION_FLAGS[region]) || []), ...GENERAL_FLAGS].filter(
    (f) => !seen.has(f.value) && seen.add(f.value)
  );
}

export type RedFlagMatch = { id: string; reason: string };

/** Returns every emergency signal in the answers (empty when none). */
export function evaluateRedFlags(a: DiagnoseAnswers): RedFlagMatch[] {
  const options = getRedFlagOptions(a.region);
  const matches: RedFlagMatch[] = [];

  for (const id of a.redFlags) {
    if (id === NO_RED_FLAGS) continue;
    const flag = options.find((f) => f.value === id);
    if (flag) matches.push({ id, reason: flag.reason });
  }

  const has = (list: string[], value: string) => list.includes(value);

  if (
    a.region === "chest" &&
    (has(a.character, "pressure") || has(a.character, "dull_aching")) &&
    (has(a.symptoms, "sweating") || has(a.symptoms, "shortness_of_breath"))
  ) {
    matches.push({
      id: "derived_cardiac",
      reason: "Chest pressure together with sweating or breathlessness can be a heart attack.",
    });
  }

  if (a.region === "head" && a.onset === "sudden" && (a.severity ?? 0) >= 9) {
    matches.push({
      id: "derived_thunderclap",
      reason: "A sudden, very severe headache can be bleeding in the brain.",
    });
  }

  if (a.region === "lower_leg" && has(a.symptoms, "calf_tender") && has(a.symptoms, "swelling")) {
    matches.push({
      id: "derived_dvt",
      reason: "A swollen, tender calf can be a blood clot (DVT) and should be checked today.",
    });
  }

  const unique = new Map(matches.map((m) => [m.id, m]));
  return [...unique.values()];
}
