import type {
  AttendanceStatus,
  LeaveStatus,
  LeaveType,
  ShiftStatus,
  StaffRole,
} from "@/types/database";

export const SHIFT_STATUSES: ShiftStatus[] = ["scheduled", "cancelled"];

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "clocked_in",
  "clocked_out",
  "missed",
  "adjusted",
];

export const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "unpaid", "emergency"];

export const LEAVE_STATUSES: LeaveStatus[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

export const ACTIVE_ATTENDANCE_STATUSES: AttendanceStatus[] = ["clocked_in"];

export const PENDING_LEAVE_STATUSES: LeaveStatus[] = ["pending"];

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  scheduled: "Scheduled",
  cancelled: "Cancelled",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  clocked_in: "Clocked in",
  clocked_out: "Clocked out",
  missed: "Missed",
  adjusted: "Adjusted",
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  unpaid: "Unpaid leave",
  emergency: "Emergency leave",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function getShiftStatusLabel(status: ShiftStatus) {
  return SHIFT_STATUS_LABELS[status];
}

export function getAttendanceStatusLabel(status: AttendanceStatus) {
  return ATTENDANCE_STATUS_LABELS[status];
}

export function getLeaveTypeLabel(type: LeaveType) {
  return LEAVE_TYPE_LABELS[type];
}

export function getLeaveStatusLabel(status: LeaveStatus) {
  return LEAVE_STATUS_LABELS[status];
}

export function attendanceStatusBadgeVariant(
  status: AttendanceStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "clocked_in":
      return "default";
    case "clocked_out":
      return "secondary";
    case "missed":
      return "destructive";
    default:
      return "outline";
  }
}

export function leaveStatusBadgeVariant(
  status: LeaveStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "outline";
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

export function canAccessAttendance() {
  return true;
}

export function canManageAttendance(role: StaffRole) {
  return role === "admin";
}

export function canScheduleShifts(role: StaffRole) {
  return role === "admin";
}

export function canReviewLeave(role: StaffRole) {
  return role === "admin";
}

export function canClockIn(
  activeRecord: { status: AttendanceStatus } | null | undefined
) {
  return !activeRecord || activeRecord.status !== "clocked_in";
}

export function canClockOut(
  activeRecord: { status: AttendanceStatus } | null | undefined
) {
  return activeRecord?.status === "clocked_in";
}

export function canCancelShift(status: ShiftStatus) {
  return status === "scheduled";
}

export function canCancelLeave(status: LeaveStatus) {
  return status === "pending" || status === "approved";
}

export function canReviewLeaveRequest(status: LeaveStatus) {
  return status === "pending";
}

export function isActiveAttendance(status: AttendanceStatus) {
  return ACTIVE_ATTENDANCE_STATUSES.includes(status);
}

export function isPendingLeave(status: LeaveStatus) {
  return PENDING_LEAVE_STATUSES.includes(status);
}

export function formatShiftTime(time: string) {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${minutes ?? "00"} ${suffix}`;
}

export function buildShiftLabel(input: {
  shiftDate: string;
  startTime: string;
  endTime: string;
}) {
  return `${input.shiftDate} · ${formatShiftTime(input.startTime)} – ${formatShiftTime(input.endTime)}`;
}

export function calculateWorkedMinutes(input: {
  clockInAt: string;
  clockOutAt?: string | null;
  now?: Date;
}) {
  const start = new Date(input.clockInAt).getTime();
  const end = input.clockOutAt
    ? new Date(input.clockOutAt).getTime()
    : (input.now ?? new Date()).getTime();

  return Math.max(0, Math.round((end - start) / 60000));
}

export function formatWorkedDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function countLeaveDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

export function sortShifts<
  T extends {
    shift_date: string;
    start_time: string;
    status: ShiftStatus;
  }
>(shifts: T[]) {
  return [...shifts].sort((left, right) => {
    const dateDiff =
      new Date(left.shift_date).getTime() - new Date(right.shift_date).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.start_time.localeCompare(right.start_time);
  });
}

export function sortAttendanceRecords<
  T extends { clock_in_at: string; status: AttendanceStatus }
>(records: T[]) {
  const statusOrder: Record<AttendanceStatus, number> = {
    clocked_in: 0,
    clocked_out: 1,
    adjusted: 2,
    missed: 3,
  };

  return [...records].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    return new Date(right.clock_in_at).getTime() - new Date(left.clock_in_at).getTime();
  });
}

export function sortLeaveRequests<
  T extends { start_date: string; status: LeaveStatus; created_at: string }
>(requests: T[]) {
  const statusOrder: Record<LeaveStatus, number> = {
    pending: 0,
    approved: 1,
    rejected: 2,
    cancelled: 3,
  };

  return [...requests].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const startDiff =
      new Date(left.start_date).getTime() - new Date(right.start_date).getTime();
    if (startDiff !== 0) {
      return startDiff;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function summarizeAttendanceReport(input: {
  records: Array<{ status: AttendanceStatus; clock_in_at: string; clock_out_at?: string | null }>;
  shifts: Array<{ status: ShiftStatus }>;
  leaveRequests: Array<{ status: LeaveStatus; leave_type: LeaveType }>;
  now?: Date;
}) {
  const byAttendanceStatus = ATTENDANCE_STATUSES.reduce<Record<AttendanceStatus, number>>(
    (totals, status) => {
      totals[status] = 0;
      return totals;
    },
    { clocked_in: 0, clocked_out: 0, missed: 0, adjusted: 0 }
  );

  const byLeaveStatus = LEAVE_STATUSES.reduce<Record<LeaveStatus, number>>(
    (totals, status) => {
      totals[status] = 0;
      return totals;
    },
    { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
  );

  const byLeaveType = LEAVE_TYPES.reduce<Record<LeaveType, number>>(
    (totals, type) => {
      totals[type] = 0;
      return totals;
    },
    { annual: 0, sick: 0, unpaid: 0, emergency: 0 }
  );

  let totalWorkedMinutes = 0;

  for (const record of input.records) {
    byAttendanceStatus[record.status] += 1;

    if (record.clock_out_at || record.status === "clocked_in") {
      totalWorkedMinutes += calculateWorkedMinutes({
        clockInAt: record.clock_in_at,
        clockOutAt: record.clock_out_at,
        now: input.now,
      });
    }
  }

  for (const request of input.leaveRequests) {
    byLeaveStatus[request.status] += 1;
    byLeaveType[request.leave_type] += 1;
  }

  const scheduledShifts = input.shifts.filter((shift) => shift.status === "scheduled").length;

  return {
    totalRecords: input.records.length,
    onDuty: byAttendanceStatus.clocked_in,
    scheduledShifts,
    pendingLeave: byLeaveStatus.pending,
    approvedLeave: byLeaveStatus.approved,
    totalWorkedMinutes,
    byAttendanceStatus,
    byLeaveStatus,
    byLeaveType,
  };
}

export function filterShiftsForStaff<
  T extends { staff_id: string }
>(shifts: T[], staffId: string | "all") {
  if (staffId === "all") {
    return shifts;
  }

  return shifts.filter((shift) => shift.staff_id === staffId);
}

export function filterRecordsForStaff<
  T extends { staff_id: string }
>(records: T[], staffId: string | "all") {
  if (staffId === "all") {
    return records;
  }

  return records.filter((record) => record.staff_id === staffId);
}

export function formatLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateToStartIso(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

export function localDateToEndIso(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function getTodayDateString(now: Date = new Date()) {
  return formatLocalDateString(now);
}

export function getWeekDateRange(now: Date = new Date()) {
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatLocalDateString(monday),
    end: formatLocalDateString(sunday),
  };
}
