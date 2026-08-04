import test from "node:test";
import assert from "node:assert/strict";
import {
  buildShiftLabel,
  calculateWorkedMinutes,
  canClockIn,
  canClockOut,
  canManageAttendance,
  canReviewLeaveRequest,
  canScheduleShifts,
  countLeaveDays,
  filterRecordsForStaff,
  filterShiftsForStaff,
  formatShiftTime,
  formatWorkedDuration,
  getWeekDateRange,
  sortAttendanceRecords,
  sortLeaveRequests,
  sortShifts,
  summarizeAttendanceReport,
} from "../src/lib/attendance";
import { isModuleImplemented, isModuleVisibleInNav } from "../src/lib/modules";

test("formatShiftTime renders readable clock labels", () => {
  assert.equal(formatShiftTime("08:00"), "8:00 AM");
  assert.equal(formatShiftTime("17:30"), "5:30 PM");
});

test("buildShiftLabel combines date and time range", () => {
  assert.equal(
    buildShiftLabel({
      shiftDate: "2026-08-03",
      startTime: "08:00",
      endTime: "17:00",
    }),
    "2026-08-03 · 8:00 AM – 5:00 PM"
  );
});

test("role helpers gate attendance management", () => {
  assert.equal(canManageAttendance("admin"), true);
  assert.equal(canManageAttendance("doctor"), false);
  assert.equal(canScheduleShifts("admin"), true);
  assert.equal(canScheduleShifts("receptionist"), false);
});

test("clock helpers enforce active attendance rules", () => {
  assert.equal(canClockIn(null), true);
  assert.equal(canClockIn({ status: "clocked_out" }), true);
  assert.equal(canClockIn({ status: "clocked_in" }), false);
  assert.equal(canClockOut({ status: "clocked_in" }), true);
  assert.equal(canClockOut(null), false);
});

test("leave review helper only allows pending requests", () => {
  assert.equal(canReviewLeaveRequest("pending"), true);
  assert.equal(canReviewLeaveRequest("approved"), false);
});

test("calculateWorkedMinutes and formatWorkedDuration handle open and closed records", () => {
  const now = new Date("2026-08-03T12:30:00.000Z");
  assert.equal(
    calculateWorkedMinutes({
      clockInAt: "2026-08-03T08:00:00.000Z",
      clockOutAt: "2026-08-03T12:00:00.000Z",
    }),
    240
  );
  assert.equal(
    calculateWorkedMinutes({
      clockInAt: "2026-08-03T08:00:00.000Z",
      now,
    }),
    270
  );
  assert.equal(formatWorkedDuration(240), "4h");
  assert.equal(formatWorkedDuration(95), "1h 35m");
});

test("countLeaveDays includes both start and end dates", () => {
  assert.equal(countLeaveDays("2026-08-03", "2026-08-03"), 1);
  assert.equal(countLeaveDays("2026-08-03", "2026-08-05"), 3);
});

test("sort helpers prioritize active work first", () => {
  const sortedRecords = sortAttendanceRecords([
    { clock_in_at: "2026-08-03T08:00:00.000Z", status: "clocked_out" },
    { clock_in_at: "2026-08-03T09:00:00.000Z", status: "clocked_in" },
  ]);
  assert.equal(sortedRecords[0]?.status, "clocked_in");

  const sortedShifts = sortShifts([
    { shift_date: "2026-08-05", start_time: "09:00", status: "scheduled" },
    { shift_date: "2026-08-03", start_time: "08:00", status: "scheduled" },
  ]);
  assert.equal(sortedShifts[0]?.shift_date, "2026-08-03");

  const sortedLeave = sortLeaveRequests([
    {
      start_date: "2026-08-10",
      status: "approved",
      created_at: "2026-08-01T08:00:00.000Z",
    },
    {
      start_date: "2026-08-12",
      status: "pending",
      created_at: "2026-08-02T08:00:00.000Z",
    },
  ]);
  assert.equal(sortedLeave[0]?.status, "pending");
});

test("filter helpers scope records to a staff member", () => {
  const shifts = [
    { staff_id: "a" },
    { staff_id: "b" },
  ];
  assert.equal(filterShiftsForStaff(shifts, "a").length, 1);
  assert.equal(filterRecordsForStaff(shifts, "all").length, 2);
});

test("summarizeAttendanceReport aggregates staffing visibility", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const report = summarizeAttendanceReport({
    records: [
      {
        status: "clocked_in",
        clock_in_at: "2026-08-03T08:00:00.000Z",
      },
      {
        status: "clocked_out",
        clock_in_at: "2026-08-03T07:00:00.000Z",
        clock_out_at: "2026-08-03T11:00:00.000Z",
      },
    ],
    shifts: [{ status: "scheduled" }, { status: "cancelled" }],
    leaveRequests: [
      { status: "pending", leave_type: "annual" },
      { status: "approved", leave_type: "sick" },
    ],
    now,
  });

  assert.equal(report.onDuty, 1);
  assert.equal(report.scheduledShifts, 1);
  assert.equal(report.pendingLeave, 1);
  assert.equal(report.approvedLeave, 1);
  assert.equal(report.byLeaveType.annual, 1);
});

test("getWeekDateRange returns a Monday-to-Sunday window", () => {
  const range = getWeekDateRange(new Date(2026, 7, 3, 10, 0, 0));
  assert.equal(range.start, "2026-08-03");
  assert.equal(range.end, "2026-08-09");
});

test("attendance module is implemented and visible when enabled", () => {
  const enabledSettings = { modules: { attendance: true } };

  assert.equal(isModuleImplemented("attendance"), true);
  assert.equal(isModuleVisibleInNav(enabledSettings, "attendance"), true);
  assert.equal(isModuleVisibleInNav({ modules: { attendance: false } }, "attendance"), false);
});
