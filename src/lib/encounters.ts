import type { Tables } from "@/types/database";

export type EncounterAccessRecord = Pick<
  Tables<"encounters">,
  | "id"
  | "clinic_id"
  | "doctor_id"
  | "status"
  | "completed_at"
  | "completed_by"
  | "amendment_started_at"
  | "amendment_started_by"
  | "last_amended_at"
  | "last_amended_by"
>;

export function computeBmi(
  weight: number | null | undefined,
  height: number | null | undefined
) {
  if (!weight || !height || weight <= 0 || height <= 0) {
    return null;
  }

  return Number((weight / ((height / 100) ** 2)).toFixed(1));
}

export function canEditEncounter(encounter: EncounterAccessRecord) {
  return encounter.status === "in_progress" || Boolean(encounter.amendment_started_at);
}

export function validateEncounterItemOrderIds(
  existingIds: string[],
  orderedIds: string[]
) {
  const sortedExisting = [...existingIds].sort();
  const sortedRequested = [...orderedIds].sort();

  if (
    sortedExisting.length !== sortedRequested.length ||
    sortedExisting.some((id, index) => id !== sortedRequested[index])
  ) {
    return {
      valid: false as const,
      message: "Unable to reorder encounter items because the list is out of date.",
    };
  }

  return { valid: true as const };
}

export function isEncounterCompleted(encounter: Pick<Tables<"encounters">, "status">) {
  return encounter.status === "completed" || encounter.status === "amended";
}
