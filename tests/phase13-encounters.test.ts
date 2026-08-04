import test from "node:test";
import assert from "node:assert/strict";
import {
  canEditEncounter,
  computeBmi,
  isEncounterCompleted,
  validateEncounterItemOrderIds,
} from "../src/lib/encounters";

const baseEncounter = {
  id: "enc-1",
  clinic_id: "clinic-1",
  doctor_id: "doctor-1",
  status: "in_progress" as const,
  completed_at: null,
  completed_by: null,
  amendment_started_at: null,
  amendment_started_by: null,
  last_amended_at: null,
  last_amended_by: null,
};

test("computeBmi returns one decimal place or null for invalid vitals", () => {
  assert.equal(computeBmi(70, 170), 24.2);
  assert.equal(computeBmi(null, 170), null);
  assert.equal(computeBmi(70, 0), null);
});

test("canEditEncounter allows in-progress and amendment sessions", () => {
  assert.equal(canEditEncounter(baseEncounter), true);
  assert.equal(
    canEditEncounter({
      ...baseEncounter,
      status: "completed",
      amendment_started_at: "2026-08-03T08:00:00.000Z",
    }),
    true
  );
  assert.equal(
    canEditEncounter({
      ...baseEncounter,
      status: "completed",
    }),
    false
  );
});

test("validateEncounterItemOrderIds rejects stale reorder payloads", () => {
  assert.equal(
    validateEncounterItemOrderIds(["a", "b"], ["a", "b"]).valid,
    true
  );
  assert.equal(
    validateEncounterItemOrderIds(["a", "b"], ["a"]).valid,
    false
  );
  assert.equal(
    validateEncounterItemOrderIds(["a"], ["b"]).valid,
    false
  );
});

test("isEncounterCompleted covers completed and amended statuses", () => {
  assert.equal(isEncounterCompleted({ status: "completed" }), true);
  assert.equal(isEncounterCompleted({ status: "amended" }), true);
  assert.equal(isEncounterCompleted({ status: "in_progress" }), false);
});
