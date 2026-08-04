import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPrescriptionSummary,
  calculateQuantityAfter,
  canAccessDispensary,
  canCancelFulfillment,
  canDispenseFulfillment,
  canManageInventory,
  filterLowStockItems,
  isLowStock,
  sortFulfillments,
  sortInventoryItems,
  sumStockMovementsByType,
  validateControlledWitness,
} from "../src/lib/dispensary";
import { isModuleImplemented, isModuleVisibleInNav } from "../src/lib/modules";

test("isLowStock compares quantity against reorder level", () => {
  assert.equal(isLowStock({ quantity_on_hand: 5, reorder_level: 10 }), true);
  assert.equal(isLowStock({ quantity_on_hand: 10, reorder_level: 10 }), true);
  assert.equal(isLowStock({ quantity_on_hand: 11, reorder_level: 10 }), false);
});

test("calculateQuantityAfter prevents negative stock", () => {
  assert.equal(calculateQuantityAfter(20, -5), 15);
  assert.throws(() => calculateQuantityAfter(3, -5), /Insufficient stock/);
});

test("validateControlledWitness requires a different witness", () => {
  assert.equal(
    validateControlledWitness({
      isControlled: false,
      dispenserStaffId: "staff-1",
      witnessStaffId: null,
    }),
    null
  );
  assert.match(
    validateControlledWitness({
      isControlled: true,
      dispenserStaffId: "staff-1",
      witnessStaffId: null,
    }) ?? "",
    /witness/i
  );
  assert.match(
    validateControlledWitness({
      isControlled: true,
      dispenserStaffId: "staff-1",
      witnessStaffId: "staff-1",
    }) ?? "",
    /different staff member/i
  );
});

test("role helpers gate dispensary actions", () => {
  assert.equal(canAccessDispensary("nurse"), true);
  assert.equal(canAccessDispensary("receptionist"), false);
  assert.equal(canManageInventory("admin"), true);
  assert.equal(canManageInventory("doctor"), false);
  assert.equal(canDispenseFulfillment("pending"), true);
  assert.equal(canCancelFulfillment("dispensed"), false);
});

test("buildPrescriptionSummary formats drug, dosage, and quantity", () => {
  assert.equal(
    buildPrescriptionSummary({
      drugName: "Amlodipine 5mg",
      dosage: "1 tab OD",
      quantityRequested: 30,
    }),
    "Amlodipine 5mg — 1 tab OD — Qty 30"
  );
});

test("sortFulfillments prioritizes pending tasks", () => {
  const sorted = sortFulfillments([
    { created_at: "2026-06-18T09:00:00.000Z", status: "dispensed" },
    { created_at: "2026-06-17T09:00:00.000Z", status: "pending" },
  ]);

  assert.equal(sorted[0]?.status, "pending");
});

test("filterLowStockItems and sortInventoryItems surface low stock first", () => {
  const items = [
    { name: "B Item", quantity_on_hand: 50, reorder_level: 10, is_active: true },
    { name: "A Item", quantity_on_hand: 2, reorder_level: 10, is_active: true },
  ];

  assert.equal(filterLowStockItems(items).length, 1);
  assert.equal(sortInventoryItems(items)[0]?.name, "A Item");
});

test("sumStockMovementsByType aggregates absolute movement totals", () => {
  const totals = sumStockMovementsByType([
    { movement_type: "receipt", quantity_change: 20 },
    { movement_type: "dispense", quantity_change: -5 },
    { movement_type: "adjustment", quantity_change: -2 },
  ]);

  assert.equal(totals.receipt, 20);
  assert.equal(totals.dispense, 5);
  assert.equal(totals.adjustment, 2);
});

test("dispensary module is implemented and visible when enabled", () => {
  const enabledSettings = { modules: { dispensary: true } };

  assert.equal(isModuleImplemented("dispensary"), true);
  assert.equal(isModuleVisibleInNav(enabledSettings, "dispensary"), true);
  assert.equal(isModuleVisibleInNav({ modules: { dispensary: false } }, "dispensary"), false);
});
