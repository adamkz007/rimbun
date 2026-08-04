import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEnquirySummary,
  canAccessEnquiry,
  canConvertEnquiry,
  canDismissReminder,
  canManageEnquiry,
  canScheduleReminder,
  deriveEnquiryStatusAfterSchedule,
  filterDueReminders,
  filterUpcomingReminders,
  isReminderDue,
  isReminderUpcoming,
  sortEnquiries,
  sortReminders,
  summarizeEnquiryReport,
} from "../src/lib/enquiry";
import { isModuleImplemented, isModuleVisibleInNav } from "../src/lib/modules";

test("buildEnquirySummary includes subject when available", () => {
  assert.equal(
    buildEnquirySummary({
      contactName: "Siti Aminah",
      source: "call",
      subject: "Consultation fees",
    }),
    "Siti Aminah — Consultation fees"
  );
  assert.equal(
    buildEnquirySummary({
      contactName: "Raj Kumar",
      source: "walk_in",
    }),
    "Raj Kumar (Walk-in)"
  );
});

test("role helpers gate enquiry access", () => {
  assert.equal(canAccessEnquiry("receptionist"), true);
  assert.equal(canAccessEnquiry("doctor"), false);
  assert.equal(canManageEnquiry("admin"), true);
  assert.equal(canManageEnquiry("nurse"), false);
});

test("status helpers control enquiry lifecycle actions", () => {
  assert.equal(canConvertEnquiry("new"), true);
  assert.equal(canConvertEnquiry("converted"), false);
  assert.equal(canScheduleReminder("closed"), false);
  assert.equal(canDismissReminder("pending"), true);
  assert.equal(canDismissReminder("dismissed"), false);
});

test("deriveEnquiryStatusAfterSchedule moves active enquiries to scheduled", () => {
  assert.equal(deriveEnquiryStatusAfterSchedule("new"), "scheduled");
  assert.equal(deriveEnquiryStatusAfterSchedule("in_progress"), "scheduled");
  assert.equal(deriveEnquiryStatusAfterSchedule("converted"), "converted");
});

test("reminder due helpers identify overdue and upcoming reminders", () => {
  const now = new Date("2026-07-11T10:00:00.000Z");

  assert.equal(isReminderDue("2026-07-11T09:00:00.000Z", now), true);
  assert.equal(isReminderDue("2026-07-11T11:00:00.000Z", now), false);
  assert.equal(isReminderUpcoming("2026-07-11T15:00:00.000Z", now, 8), true);
  assert.equal(isReminderUpcoming("2026-07-12T15:00:00.000Z", now, 8), false);
});

test("sortEnquiries prioritizes active statuses and scheduled dates", () => {
  const sorted = sortEnquiries([
    {
      created_at: "2026-07-10T09:00:00.000Z",
      status: "closed",
      scheduled_at: null,
    },
    {
      created_at: "2026-07-11T09:00:00.000Z",
      status: "new",
      scheduled_at: null,
    },
    {
      created_at: "2026-07-09T09:00:00.000Z",
      status: "scheduled",
      scheduled_at: "2026-07-12T09:00:00.000Z",
    },
  ]);

  assert.equal(sorted[0]?.status, "new");
  assert.equal(sorted[1]?.status, "scheduled");
});

test("sortReminders and filter helpers surface pending work first", () => {
  const reminders = [
    { remind_at: "2026-07-12T09:00:00.000Z", status: "dismissed" as const },
    { remind_at: "2026-07-11T08:00:00.000Z", status: "pending" as const },
    { remind_at: "2026-07-12T08:00:00.000Z", status: "pending" as const },
  ];

  const sorted = sortReminders(reminders);
  assert.equal(sorted[0]?.status, "pending");
  assert.equal(sorted[0]?.remind_at, "2026-07-11T08:00:00.000Z");

  const now = new Date("2026-07-11T10:00:00.000Z");
  assert.equal(filterDueReminders(reminders, now).length, 1);
  assert.equal(filterUpcomingReminders(reminders, now, 24).length, 1);
});

test("summarizeEnquiryReport aggregates status and source totals", () => {
  const report = summarizeEnquiryReport([
    { status: "new", source: "call" },
    { status: "scheduled", source: "appointment" },
    { status: "converted", source: "walk_in" },
    { status: "converted", source: "call" },
  ]);

  assert.equal(report.total, 4);
  assert.equal(report.active, 2);
  assert.equal(report.converted, 2);
  assert.equal(report.byStatus.new, 1);
  assert.equal(report.bySource.call, 2);
});

test("enquiry module is implemented and visible when enabled", () => {
  const enabledSettings = { modules: { enquiry: true } };

  assert.equal(isModuleImplemented("enquiry"), true);
  assert.equal(isModuleVisibleInNav(enabledSettings, "enquiry"), true);
  assert.equal(isModuleVisibleInNav({ modules: { enquiry: false } }, "enquiry"), false);
});
