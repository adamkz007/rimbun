import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPrescriptionLineDescription,
  calculateLineTotal,
  canEditInvoice,
  canIssueInvoice,
  canManageBilling,
  canRecordPayment,
  canVoidInvoice,
  deriveInvoiceStatus,
  formatCurrency,
  formatInvoiceNumber,
  getOutstandingBalance,
  getPaymentMethodLabel,
  roundMoney,
  sortInvoices,
  sumLineTotals,
  sumPayments,
} from "../src/lib/billing";
import { isModuleImplemented, isModuleVisibleInNav } from "../src/lib/modules";

test("formatInvoiceNumber pads invoice numbers to five digits", () => {
  assert.equal(formatInvoiceNumber(1), "INV-00001");
  assert.equal(formatInvoiceNumber(128), "INV-00128");
});

test("calculateLineTotal and money helpers round to two decimals", () => {
  assert.equal(calculateLineTotal(2, 12.345), 24.69);
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(sumLineTotals([{ line_total: 10.5 }, { line_total: 4.25 }]), 14.75);
  assert.equal(sumPayments([{ amount: 20 }, { amount: 5.5 }]), 25.5);
});

test("deriveInvoiceStatus maps payment progress to invoice status", () => {
  assert.equal(
    deriveInvoiceStatus({ currentStatus: "draft", total: 100, amountPaid: 0 }),
    "draft"
  );
  assert.equal(
    deriveInvoiceStatus({ currentStatus: "issued", total: 100, amountPaid: 0 }),
    "issued"
  );
  assert.equal(
    deriveInvoiceStatus({ currentStatus: "issued", total: 100, amountPaid: 40 }),
    "partial"
  );
  assert.equal(
    deriveInvoiceStatus({ currentStatus: "partial", total: 100, amountPaid: 100 }),
    "paid"
  );
  assert.equal(
    deriveInvoiceStatus({ currentStatus: "void", total: 100, amountPaid: 50 }),
    "void"
  );
});

test("role and status helpers gate billing actions", () => {
  assert.equal(canManageBilling("receptionist"), true);
  assert.equal(canManageBilling("doctor"), false);
  assert.equal(canEditInvoice("draft"), true);
  assert.equal(canEditInvoice("issued"), false);
  assert.equal(canIssueInvoice("draft"), true);
  assert.equal(canRecordPayment("partial"), true);
  assert.equal(canRecordPayment("draft"), false);
  assert.equal(canVoidInvoice("paid"), false);
  assert.equal(canVoidInvoice("issued"), true);
});

test("buildPrescriptionLineDescription includes drug, dosage, and quantity", () => {
  assert.equal(
    buildPrescriptionLineDescription({
      drugName: "Metformin 500mg",
      dosage: "1 tab BD",
      quantity: 30,
    }),
    "Metformin 500mg — 1 tab BD — Qty 30"
  );
});

test("getOutstandingBalance never returns negative values", () => {
  assert.equal(getOutstandingBalance(80, 20), 60);
  assert.equal(getOutstandingBalance(80, 100), 0);
});

test("sortInvoices prefers newest created_at values", () => {
  const sorted = sortInvoices([
    { created_at: "2026-06-17T09:00:00.000Z", invoice_number: 2 },
    { created_at: "2026-06-18T09:00:00.000Z", invoice_number: 1 },
  ]);

  assert.equal(sorted[0]?.invoice_number, 1);
});

test("formatCurrency and payment labels render MYR values", () => {
  assert.match(formatCurrency(50), /50\.00/);
  assert.equal(getPaymentMethodLabel("bank_transfer"), "Bank transfer");
});

test("billing module is implemented and visible when enabled", () => {
  const enabledSettings = { modules: { billing: true } };

  assert.equal(isModuleImplemented("billing"), true);
  assert.equal(isModuleVisibleInNav(enabledSettings, "billing"), true);
  assert.equal(isModuleVisibleInNav({ modules: { billing: false } }, "billing"), false);
});
