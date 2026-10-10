import { ANATOMY_INDEX } from "./anatomy-index.ts";

// Body frame used by the 3D viewer: metres, +Y up (feet at 0), +Z towards the
// viewer (anterior), +X towards the patient's LEFT. See scripts/anatomy/.

export type Vec3 = [number, number, number];

export type StructureKey = keyof typeof ANATOMY_INDEX.structures;

export const STRUCTURE_KEYS = Object.keys(ANATOMY_INDEX.structures) as StructureKey[];

export type RegionId =
  | "head"
  | "neck"
  | "chest"
  | "abdomen"
  | "back"
  | "pelvis"
  | "shoulder"
  | "arm"
  | "hand"
  | "hip"
  | "knee"
  | "lower_leg"
  | "foot";

export type Side = "left" | "right" | "both";

export type SpinalLevel = "cranial" | "cervical" | "thoracic" | "lumbar" | "sacral";

export type SubLocation = {
  id: string;
  label: string;
  hint?: string;
  /** Point to zoom to, for the patient's right side when the region is lateral. */
  focus: Vec3;
  structures: StructureKey[];
};

export type Region = {
  id: RegionId;
  label: string;
  /** True when the region exists on both sides of the body. */
  lateral: boolean;
  camera: { target: Vec3; distance: number };
  structures: StructureKey[];
  spinalLevel: SpinalLevel;
  subLocations: SubLocation[];
};

/** Translucent body-shell primitives; they double as click targets. */
export type ShellPart = {
  region: RegionId;
  side?: "left" | "right";
  shape: "ellipsoid" | "capsule";
  /** Ellipsoid centre, or capsule start. */
  a: Vec3;
  /** Capsule end. */
  b?: Vec3;
  /** Ellipsoid radii, or [capsuleRadius, 0, 0]. */
  radii: Vec3;
};

export function structureCenter(key: StructureKey): Vec3 {
  const center = ANATOMY_INDEX.structures[key].center;
  return [center[0], center[1], center[2]];
}

/** Mirror a point from the patient's right side (-X) to the requested side. */
export function sidePoint(point: Vec3, side: Side | null | undefined): Vec3 {
  if (side === "left") return [Math.abs(point[0]), point[1], point[2]];
  if (side === "right") return [-Math.abs(point[0]), point[1], point[2]];
  return point;
}

export const REGIONS: Region[] = [
  {
    id: "head",
    label: "Head & face",
    lateral: false,
    camera: { target: [0, 1.65, 0], distance: 0.55 },
    structures: ["cerebrum", "head_skin"],
    spinalLevel: "cranial",
    subLocations: [
      { id: "forehead", label: "Forehead", focus: [0, 1.7, 0.08], structures: ["cerebrum"] },
      { id: "temples", label: "Temples / sides of head", focus: [-0.075, 1.68, 0.02], structures: ["cerebrum", "jaw_muscles"] },
      { id: "top", label: "Top of head", focus: [0, 1.74, 0], structures: ["cerebrum", "somatosensory_cortex"] },
      { id: "back_of_head", label: "Back of head", focus: [0, 1.64, -0.09], structures: ["cerebellum", "brainstem"] },
      { id: "eyes", label: "Around the eyes", focus: [0, 1.65, 0.08], structures: ["eyes"] },
      { id: "jaw", label: "Jaw / teeth", focus: [-0.05, 1.58, 0.06], structures: ["jaw_muscles"] },
      { id: "whole_head", label: "Whole head", focus: [0, 1.66, 0], structures: ["cerebrum"] },
    ],
  },
  {
    id: "neck",
    label: "Neck & throat",
    lateral: false,
    camera: { target: [0, 1.52, 0], distance: 0.6 },
    structures: ["airway", "esophagus"],
    spinalLevel: "cervical",
    subLocations: [
      { id: "throat", label: "Throat (front)", focus: [0, 1.52, 0.04], structures: ["airway", "esophagus"] },
      { id: "side_neck", label: "Side of neck", focus: [-0.05, 1.52, 0], structures: ["airway"] },
      { id: "back_neck", label: "Back of neck", focus: [0, 1.53, -0.06], structures: ["thoracic_spine"] },
    ],
  },
  {
    id: "chest",
    label: "Chest",
    lateral: false,
    camera: { target: [0, 1.32, 0.02], distance: 0.85 },
    structures: ["heart", "right_lung", "left_lung", "ribs", "sternum"],
    spinalLevel: "thoracic",
    subLocations: [
      { id: "central_chest", label: "Centre (behind breastbone)", focus: [0.01, 1.32, 0.07], structures: ["heart", "sternum", "esophagus"] },
      { id: "left_chest", label: "Left side of chest", focus: [0.09, 1.33, 0.05], structures: ["heart", "left_lung", "ribs"] },
      { id: "right_chest", label: "Right side of chest", focus: [-0.09, 1.33, 0.05], structures: ["right_lung", "ribs"] },
      { id: "lower_ribs", label: "Lower ribs", focus: [-0.11, 1.22, 0.05], structures: ["ribs"] },
      { id: "breathing", label: "Hurts when breathing in", focus: [0, 1.3, 0.04], structures: ["right_lung", "left_lung", "ribs"] },
    ],
  },
  {
    id: "abdomen",
    label: "Stomach / abdomen",
    lateral: false,
    camera: { target: [0, 1.16, 0.02], distance: 0.75 },
    structures: ["liver", "stomach", "intestines", "gallbladder", "pancreas", "spleen"],
    spinalLevel: "thoracic",
    subLocations: [
      { id: "right_upper", label: "Upper right (under ribs)", hint: "liver, gallbladder", focus: [-0.05, 1.19, 0.03], structures: ["liver", "gallbladder"] },
      { id: "epigastric", label: "Upper middle (below breastbone)", hint: "stomach, pancreas", focus: [0.01, 1.2, 0.04], structures: ["stomach", "pancreas"] },
      { id: "left_upper", label: "Upper left", hint: "stomach, spleen", focus: [0.06, 1.2, 0.02], structures: ["stomach", "spleen"] },
      { id: "periumbilical", label: "Around the belly button", focus: [0, 1.14, 0.05], structures: ["intestines"] },
      { id: "right_lower", label: "Lower right", hint: "appendix area", focus: [-0.06, 1.1, 0.04], structures: ["intestines"] },
      { id: "left_lower", label: "Lower left", focus: [0.06, 1.1, 0.04], structures: ["intestines"] },
      { id: "flank", label: "Side / flank", hint: "kidneys", focus: [-0.08, 1.17, -0.02], structures: ["right_kidney", "left_kidney", "ureters"] },
      { id: "all_over", label: "All over", focus: [0, 1.15, 0.03], structures: ["stomach", "intestines", "liver"] },
    ],
  },
  {
    id: "back",
    label: "Back",
    lateral: false,
    camera: { target: [0, 1.22, -0.05], distance: 0.95 },
    structures: ["thoracic_spine", "lumbar_spine", "back_muscles"],
    spinalLevel: "lumbar",
    subLocations: [
      { id: "upper_back", label: "Upper back / between shoulder blades", focus: [0, 1.36, -0.08], structures: ["thoracic_spine", "shoulder_girdle"] },
      { id: "mid_back", label: "Middle back", focus: [0, 1.24, -0.08], structures: ["thoracic_spine", "back_muscles"] },
      { id: "lower_back", label: "Lower back", focus: [0, 1.12, -0.08], structures: ["lumbar_spine", "back_muscles"] },
      { id: "loin", label: "Loin (one side, below ribs)", hint: "kidneys", focus: [-0.05, 1.17, -0.06], structures: ["right_kidney", "left_kidney"] },
      { id: "tailbone", label: "Tailbone / buttock", focus: [0, 1.02, -0.08], structures: ["pelvis", "gluteal_muscles"] },
    ],
  },
  {
    id: "pelvis",
    label: "Pelvis & groin",
    lateral: false,
    camera: { target: [0, 1.0, 0.02], distance: 0.75 },
    structures: ["pelvis", "ureters", "hip_flexors"],
    spinalLevel: "sacral",
    subLocations: [
      { id: "suprapubic", label: "Above the pubic bone", hint: "bladder, uterus", focus: [0, 1.0, 0.07], structures: ["pelvis", "ureters"] },
      { id: "groin", label: "Groin", focus: [-0.08, 0.96, 0.06], structures: ["hip_flexors", "pelvis"] },
      { id: "genital", label: "Genital area", focus: [0, 0.92, 0.06], structures: ["pelvis"] },
    ],
  },
  {
    id: "shoulder",
    label: "Shoulder",
    lateral: true,
    camera: { target: [-0.17, 1.43, 0], distance: 0.6 },
    structures: ["shoulder_girdle"],
    spinalLevel: "cervical",
    subLocations: [
      { id: "front_shoulder", label: "Front of shoulder", focus: [-0.18, 1.43, 0.04], structures: ["shoulder_girdle"] },
      { id: "top_shoulder", label: "Top / tip of shoulder", focus: [-0.18, 1.47, 0], structures: ["shoulder_girdle"] },
      { id: "back_shoulder", label: "Back of shoulder / shoulder blade", focus: [-0.12, 1.4, -0.08], structures: ["shoulder_girdle"] },
    ],
  },
  {
    id: "arm",
    label: "Arm & elbow",
    lateral: true,
    camera: { target: [-0.23, 1.15, 0], distance: 0.9 },
    structures: [],
    spinalLevel: "cervical",
    subLocations: [
      { id: "upper_arm", label: "Upper arm", focus: [-0.215, 1.28, 0], structures: [] },
      { id: "elbow", label: "Elbow", focus: [-0.24, 1.12, 0], structures: [] },
      { id: "forearm", label: "Forearm", focus: [-0.255, 1.0, 0], structures: [] },
      { id: "wrist", label: "Wrist", focus: [-0.27, 0.88, 0.01], structures: [] },
    ],
  },
  {
    id: "hand",
    label: "Hand & fingers",
    lateral: true,
    camera: { target: [-0.28, 0.8, 0.01], distance: 0.45 },
    structures: [],
    spinalLevel: "cervical",
    subLocations: [
      { id: "palm", label: "Palm", focus: [-0.28, 0.82, 0.02], structures: [] },
      { id: "fingers", label: "Fingers", focus: [-0.285, 0.75, 0.01], structures: [] },
      { id: "thumb", label: "Thumb", focus: [-0.26, 0.8, 0.04], structures: [] },
    ],
  },
  {
    id: "hip",
    label: "Hip & thigh",
    lateral: true,
    camera: { target: [-0.1, 0.85, 0], distance: 0.9 },
    structures: ["gluteal_muscles", "hip_flexors", "pelvis"],
    spinalLevel: "lumbar",
    subLocations: [
      { id: "hip_joint", label: "Hip joint", focus: [-0.1, 0.93, 0.02], structures: ["pelvis", "hip_flexors"] },
      { id: "outer_hip", label: "Outer hip", focus: [-0.16, 0.92, 0], structures: ["gluteal_muscles"] },
      { id: "front_thigh", label: "Front of thigh", focus: [-0.095, 0.72, 0.06], structures: ["thigh_muscles"] },
      { id: "back_thigh", label: "Back of thigh", focus: [-0.095, 0.72, -0.06], structures: ["thigh_muscles"] },
    ],
  },
  {
    id: "knee",
    label: "Knee",
    lateral: true,
    camera: { target: [-0.095, 0.5, 0.01], distance: 0.42 },
    structures: ["femur", "tibia", "patella", "menisci", "cruciate_ligaments", "collateral_ligaments"],
    spinalLevel: "lumbar",
    subLocations: [
      { id: "front_knee", label: "Front / kneecap", focus: [-0.1, 0.52, 0.045], structures: ["patella", "patellar_tendon", "knee_cartilage"] },
      { id: "inner_knee", label: "Inner side", focus: [-0.06, 0.49, 0.0], structures: ["menisci", "collateral_ligaments"] },
      { id: "outer_knee", label: "Outer side", focus: [-0.135, 0.49, 0.0], structures: ["menisci", "collateral_ligaments", "fibula"] },
      { id: "back_knee", label: "Back of knee", focus: [-0.095, 0.5, -0.04], structures: ["calf_muscles", "knee_nerves"] },
      { id: "deep_knee", label: "Deep inside the knee", focus: [-0.09, 0.495, 0], structures: ["cruciate_ligaments", "menisci"] },
    ],
  },
  {
    id: "lower_leg",
    label: "Lower leg & ankle",
    lateral: true,
    camera: { target: [-0.097, 0.28, 0], distance: 0.8 },
    structures: ["tibia", "fibula", "calf_muscles"],
    spinalLevel: "lumbar",
    subLocations: [
      { id: "shin", label: "Shin", focus: [-0.097, 0.3, 0.04], structures: ["tibia"] },
      { id: "calf", label: "Calf", focus: [-0.097, 0.33, -0.04], structures: ["calf_muscles"] },
      { id: "ankle", label: "Ankle", focus: [-0.098, 0.1, 0.0], structures: [] },
    ],
  },
  {
    id: "foot",
    label: "Foot & toes",
    lateral: true,
    camera: { target: [-0.1, 0.05, 0.05], distance: 0.5 },
    structures: [],
    spinalLevel: "sacral",
    subLocations: [
      { id: "heel", label: "Heel", focus: [-0.1, 0.03, -0.04], structures: [] },
      { id: "sole", label: "Sole / arch", focus: [-0.1, 0.01, 0.05], structures: [] },
      { id: "top_foot", label: "Top of foot", focus: [-0.1, 0.06, 0.08], structures: [] },
      { id: "toes", label: "Toes", focus: [-0.1, 0.03, 0.15], structures: [] },
    ],
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>;

export const REGION_IDS = REGIONS.map((r) => r.id) as [RegionId, ...RegionId[]];

export function getRegion(id: string | null | undefined): Region | null {
  return id && id in REGION_BY_ID ? REGION_BY_ID[id as RegionId] : null;
}

export function getSubLocation(regionId: string | null | undefined, subId: string | null | undefined) {
  return getRegion(regionId)?.subLocations.find((s) => s.id === subId) ?? null;
}

const L = 1;
const R = -1;
const mirror = (x: number, s: number) => x * s;

function bilateral(part: Omit<ShellPart, "side">): ShellPart[] {
  return [R, L].map((s) => ({
    ...part,
    side: s === L ? "left" : "right",
    a: [mirror(part.a[0], s), part.a[1], part.a[2]] as Vec3,
    b: part.b ? ([mirror(part.b[0], s), part.b[1], part.b[2]] as Vec3) : undefined,
  }));
}

export const BODY_SHELL: ShellPart[] = [
  { region: "head", shape: "ellipsoid", a: [0, 1.655, 0], radii: [0.082, 0.105, 0.1] },
  { region: "neck", shape: "capsule", a: [0, 1.49, -0.015], b: [0, 1.56, -0.01], radii: [0.055, 0, 0] },
  { region: "chest", shape: "ellipsoid", a: [0, 1.32, -0.005], radii: [0.165, 0.165, 0.115] },
  { region: "abdomen", shape: "ellipsoid", a: [0, 1.14, -0.005], radii: [0.145, 0.12, 0.1] },
  { region: "pelvis", shape: "ellipsoid", a: [0, 0.99, -0.01], radii: [0.168, 0.095, 0.105] },
  ...bilateral({ region: "shoulder", shape: "ellipsoid", a: [0.185, 1.435, -0.01], radii: [0.06, 0.055, 0.06] }),
  ...bilateral({ region: "arm", shape: "capsule", a: [0.205, 1.4, -0.01], b: [0.24, 1.12, -0.005], radii: [0.042, 0, 0] }),
  ...bilateral({ region: "arm", shape: "capsule", a: [0.24, 1.12, -0.005], b: [0.27, 0.87, 0.01], radii: [0.035, 0, 0] }),
  ...bilateral({ region: "hand", shape: "ellipsoid", a: [0.28, 0.79, 0.012], radii: [0.022, 0.07, 0.04] }),
  ...bilateral({ region: "hip", shape: "capsule", a: [0.095, 0.92, -0.005], b: [0.095, 0.56, 0.0], radii: [0.072, 0, 0] }),
  ...bilateral({ region: "knee", shape: "ellipsoid", a: [0.095, 0.495, 0.005], radii: [0.058, 0.07, 0.058] }),
  ...bilateral({ region: "lower_leg", shape: "capsule", a: [0.097, 0.43, -0.01], b: [0.098, 0.09, -0.005], radii: [0.048, 0, 0] }),
  ...bilateral({ region: "foot", shape: "ellipsoid", a: [0.1, 0.035, 0.045], radii: [0.043, 0.035, 0.115] }),
];

/** Where the signal from each spinal level joins the spinal cord (body frame). */
export const SPINAL_ENTRY: Record<SpinalLevel, Vec3> = {
  cranial: [0, 1.6, -0.02],
  cervical: [0, 1.48, -0.045],
  thoracic: [0, 1.28, -0.06],
  lumbar: [0, 1.13, -0.045],
  sacral: [0, 1.04, -0.05],
};

/** Ascending pain pathway from the spinal cord to the sensory cortex. */
export const BRAIN_PATH: { label: string; point: Vec3 }[] = [
  { label: "Brainstem", point: structureCenter("brainstem") },
  { label: "Thalamus (relay)", point: structureCenter("thalamus") },
  { label: "Somatosensory cortex", point: [-0.035, 1.725, -0.025] },
];

/** Classic referred-pain targets the assessment may point at. */
export const REFERRED_AREAS = {
  left_arm: { label: "Left arm", point: [0.24, 1.2, 0] as Vec3 },
  right_arm: { label: "Right arm", point: [-0.24, 1.2, 0] as Vec3 },
  jaw: { label: "Jaw", point: [0, 1.57, 0.06] as Vec3 },
  neck: { label: "Neck", point: [0, 1.52, 0.02] as Vec3 },
  right_shoulder: { label: "Right shoulder tip", point: [-0.18, 1.46, 0] as Vec3 },
  left_shoulder: { label: "Left shoulder tip", point: [0.18, 1.46, 0] as Vec3 },
  between_shoulder_blades: { label: "Between shoulder blades", point: [0, 1.36, -0.09] as Vec3 },
  upper_abdomen: { label: "Upper abdomen", point: [0, 1.2, 0.05] as Vec3 },
  belly_button: { label: "Around the belly button", point: [0, 1.14, 0.06] as Vec3 },
  groin: { label: "Groin", point: [-0.08, 0.96, 0.06] as Vec3 },
  lower_back: { label: "Lower back", point: [0, 1.12, -0.09] as Vec3 },
  knee: { label: "Knee", point: [-0.095, 0.5, 0.04] as Vec3 },
  thigh: { label: "Thigh", point: [-0.095, 0.72, 0.05] as Vec3 },
  leg: { label: "Down the leg", point: [-0.097, 0.3, 0] as Vec3 },
} as const;

export type ReferredAreaId = keyof typeof REFERRED_AREAS;

export const REFERRED_AREA_IDS = Object.keys(REFERRED_AREAS) as [ReferredAreaId, ...ReferredAreaId[]];
