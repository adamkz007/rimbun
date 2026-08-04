import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_QUEUE_STATUSES,
  canCancelQueueEntry,
  canCheckInPatients,
  canStartEncounterFromQueue,
  canUpdateQueueStatus,
  formatQueueNumber,
  formatWaitDuration,
  getQueueStatusLabel,
  getTodayUtcBounds,
  isActiveQueueStatus,
  sortQueueEntries,
} from "../src/lib/queue";
import { isModuleImplemented, isModuleVisibleInNav } from "../src/lib/modules";

test("formatQueueNumber pads queue numbers to three digits", () => {
  assert.equal(formatQueueNumber(1), "001");
  assert.equal(formatQueueNumber(42), "042");
  assert.equal(formatQueueNumber(128), "128");
});

test("formatWaitDuration renders minute and hour labels", () => {
  const checkedInAt = new Date("2026-06-17T10:00:00.000Z");
  const thirtyMinutesLater = new Date("2026-06-17T10:30:00.000Z");
  const ninetyMinutesLater = new Date("2026-06-17T11:30:00.000Z");

  assert.equal(formatWaitDuration(checkedInAt, thirtyMinutesLater), "30 min");
  assert.equal(formatWaitDuration(checkedInAt, ninetyMinutesLater), "1 hr 30 min");
});

test("sortQueueEntries orders by sort_order then checked_in_at", () => {
  const sorted = sortQueueEntries([
    { id: "b", sort_order: 1, checked_in_at: "2026-06-17T09:00:00.000Z" },
    { id: "a", sort_order: 0, checked_in_at: "2026-06-17T10:00:00.000Z" },
    { id: "c", sort_order: 1, checked_in_at: "2026-06-17T08:30:00.000Z" },
  ]);

  assert.deepEqual(sorted.map((entry) => entry.id), ["a", "c", "b"]);
});

test("isActiveQueueStatus covers the live queue lifecycle", () => {
  for (const status of ACTIVE_QUEUE_STATUSES) {
    assert.equal(isActiveQueueStatus(status), true);
  }

  assert.equal(isActiveQueueStatus("completed"), false);
  assert.equal(isActiveQueueStatus("cancelled"), false);
  assert.equal(getQueueStatusLabel("with_nurse"), "With nurse");
});

test("role helpers gate queue board actions", () => {
  assert.equal(canCheckInPatients("receptionist"), true);
  assert.equal(canCheckInPatients("doctor"), false);
  assert.equal(canCancelQueueEntry("receptionist"), true);
  assert.equal(canStartEncounterFromQueue("doctor"), true);
  assert.equal(canStartEncounterFromQueue("nurse"), false);
});

test("canUpdateQueueStatus enforces nurse and doctor handoffs", () => {
  assert.equal(canUpdateQueueStatus("nurse", "waiting", "with_nurse"), true);
  assert.equal(canUpdateQueueStatus("nurse", "with_nurse", "waiting"), true);
  assert.equal(canUpdateQueueStatus("nurse", "waiting", "with_doctor"), false);
  assert.equal(canUpdateQueueStatus("doctor", "with_nurse", "with_doctor"), true);
  assert.equal(canUpdateQueueStatus("receptionist", "waiting", "cancelled"), false);
});

test("getTodayUtcBounds returns a same-day UTC window", () => {
  const reference = new Date("2026-06-17T15:30:00.000Z");
  const bounds = getTodayUtcBounds(reference);

  assert.equal(bounds.start, "2026-06-17T00:00:00.000Z");
  assert.equal(bounds.end, "2026-06-18T00:00:00.000Z");
});

test("queue module is implemented and visible when enabled", () => {
  const enabledSettings = { modules: { queue: true } };

  assert.equal(isModuleImplemented("queue"), true);
  assert.equal(isModuleVisibleInNav(enabledSettings, "queue"), true);
});
