import {
  BRAIN_PATH,
  getRegion,
  getSubLocation,
  REFERRED_AREAS,
  sidePoint,
  SPINAL_ENTRY,
  type ReferredAreaId,
  type Side,
  type SpinalLevel,
  type StructureKey,
  type Vec3,
} from "./anatomy.ts";
import type { DiagnoseAnswers } from "./questions.ts";

// Camera framing for the anatomy viewer, derived from the answers so the
// model zooms in as the questions narrow down.

export type ViewTarget = { target: Vec3; distance: number; direction: Vec3 };

const FRONT: Vec3 = [0.25, 0.12, 1];
const BEHIND: Vec3 = [0.3, 0.12, -1];
const SIDE: Vec3 = [1, 0.1, -0.35];

export const OVERVIEW: ViewTarget = { target: [0, 0.9, 0], distance: 3.9, direction: [0.15, 0.08, 1] };

type Where = Pick<DiagnoseAnswers, "region" | "side" | "subLocation">;

function placeOnSide(point: Vec3, regionLateral: boolean, side: Side | null): Vec3 {
  if (!regionLateral) return point;
  if (side === "both") return [0, point[1], point[2]];
  return sidePoint(point, side ?? "right");
}

export function viewForAnswers(a: Where): ViewTarget {
  const region = getRegion(a.region);
  if (!region) return OVERVIEW;

  const sub = getSubLocation(a.region, a.subLocation);
  const point = sub?.focus ?? region.camera.target;
  const target = placeOnSide(point, region.lateral, a.side);
  const fromBehind = region.id === "back" || point[2] < -0.035;
  const both = region.lateral && a.side === "both";
  const distance = (sub ? region.camera.distance * 0.9 : region.camera.distance) * (both ? 1.6 : 1);

  const direction: Vec3 = fromBehind ? [...BEHIND] : [...FRONT];
  // Look at lateral parts from their own side.
  if (region.lateral && !both) direction[0] = target[0] >= 0 ? 0.45 : -0.45;

  return { target, distance, direction };
}

/** Where the pain starts, in the body frame. */
export function originForAnswers(a: Where): Vec3 {
  const region = getRegion(a.region);
  if (!region) return [0, 1.2, 0];
  const sub = getSubLocation(a.region, a.subLocation);
  const side = a.side === "both" ? "right" : a.side;
  return placeOnSide(sub?.focus ?? region.camera.target, region.lateral, side);
}

export function spinalLevelForAnswers(a: Where): SpinalLevel {
  const region = getRegion(a.region);
  if (!region) return "thoracic";
  if (region.id === "back") {
    if (a.subLocation === "upper_back") return "thoracic";
    if (a.subLocation === "tailbone") return "sacral";
  }
  if (region.id === "abdomen" && (a.subLocation === "right_lower" || a.subLocation === "left_lower")) {
    return "lumbar";
  }
  return region.spinalLevel;
}

export function highlightForAnswers(a: Where): StructureKey[] {
  const region = getRegion(a.region);
  if (!region) return [];
  const sub = getSubLocation(a.region, a.subLocation);
  return sub ? sub.structures : region.structures;
}

export type ExplainStage = 0 | 1 | 2 | 3;

export function viewForStage(stage: ExplainStage, origin: Vec3, level: SpinalLevel, referred: ReferredAreaId[]): ViewTarget {
  const brain = BRAIN_PATH[1].point;
  switch (stage) {
    case 0:
      return { target: origin, distance: 0.6, direction: origin[2] < -0.035 ? BEHIND : FRONT };
    case 1:
      return { target: SPINAL_ENTRY[level], distance: 0.85, direction: SIDE };
    case 2:
      return { target: brain, distance: 0.55, direction: [0.6, 0.25, 1] };
    case 3: {
      const points = [origin, brain, ...referred.map((r) => REFERRED_AREAS[r].point)];
      const ys = points.map((p) => p[1]);
      const xs = points.map((p) => p[0]);
      const span = Math.max(Math.max(...ys) - Math.min(...ys), Math.max(...xs) - Math.min(...xs));
      const target: Vec3 = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, 0];
      return { target, distance: Math.max(0.9, span * 2.6), direction: [0.35, 0.1, 1] };
    }
  }
}
