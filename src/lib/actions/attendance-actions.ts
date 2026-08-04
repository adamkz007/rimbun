"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import {
  canCancelLeave,
  canCancelShift,
  canClockIn,
  canClockOut,
  canReviewLeaveRequest,
} from "@/lib/attendance";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceStatus, LeaveStatus, LeaveType, Tables } from "@/types/database";

type AttendanceRecord = Pick<
  Tables<"attendance_records">,
  "id" | "clinic_id" | "staff_id" | "shift_id" | "clock_in_at" | "clock_out_at" | "status"
>;

type ShiftRecord = Pick<
  Tables<"staff_shifts">,
  "id" | "clinic_id" | "staff_id" | "shift_date" | "start_time" | "end_time" | "status"
>;

type LeaveRecord = Pick<
  Tables<"leave_requests">,
  "id" | "clinic_id" | "staff_id" | "leave_type" | "status" | "start_date" | "end_date"
>;

const ATTENDANCE_ROLES = ["admin", "doctor", "nurse", "receptionist"] as const;

const scheduleShiftSchema = z.object({
  staffId: z.uuid(),
  shiftDate: z.string().date(),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a valid start time."),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a valid end time."),
  notes: z.string().trim().max(500).optional(),
});

const cancelShiftSchema = z.object({
  shiftId: z.uuid(),
});

const clockInSchema = z.object({
  shiftId: z.uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

const clockOutSchema = z.object({
  recordId: z.uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

const createLeaveRequestSchema = z.object({
  leaveType: z.enum(["annual", "sick", "unpaid", "emergency"]),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().trim().max(1000).optional(),
});

const reviewLeaveSchema = z.object({
  leaveId: z.uuid(),
  status: z.enum(["approved", "rejected"]),
});

const cancelLeaveSchema = z.object({
  leaveId: z.uuid(),
});

export type AttendanceActionResult = {
  success: boolean;
  message: string;
  recordId?: string;
  shiftId?: string;
  leaveId?: string;
};

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function revalidateAttendancePaths() {
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}

async function getActiveAttendanceRecord(staffId: string, clinicId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id, clinic_id, staff_id, shift_id, clock_in_at, clock_out_at, status")
    .eq("clinic_id", clinicId)
    .eq("staff_id", staffId)
    .eq("status", "clocked_in")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AttendanceRecord | null;
}

async function getAttendanceRecord(recordId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ATTENDANCE_ROLES],
    module: "attendance",
  });

  const { data, error } = await supabase
    .from("attendance_records")
    .select("id, clinic_id, staff_id, shift_id, clock_in_at, clock_out_at, status")
    .eq("id", recordId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Attendance record not found.");
  }

  return { supabase, staff, record: data as AttendanceRecord };
}

async function getShiftRecord(shiftId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ATTENDANCE_ROLES],
    module: "attendance",
  });

  const { data, error } = await supabase
    .from("staff_shifts")
    .select("id, clinic_id, staff_id, shift_date, start_time, end_time, status")
    .eq("id", shiftId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Shift not found.");
  }

  return { supabase, staff, shift: data as ShiftRecord };
}

async function getLeaveRecord(leaveId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ATTENDANCE_ROLES],
    module: "attendance",
  });

  const { data, error } = await supabase
    .from("leave_requests")
    .select("id, clinic_id, staff_id, leave_type, status, start_date, end_date")
    .eq("id", leaveId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Leave request not found.");
  }

  return { supabase, staff, leave: data as LeaveRecord };
}

async function assertStaffInClinic(staffId: string, clinicId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, role")
    .eq("id", staffId)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return null;
  }

  return data;
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function scheduleShift(
  input: z.input<typeof scheduleShiftSchema>
): Promise<AttendanceActionResult> {
  const parsed = scheduleShiftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid shift details.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["admin"],
    module: "attendance",
  });

  const targetStaff = await assertStaffInClinic(parsed.data.staffId, staff.clinic_id);
  if (!targetStaff) {
    return { success: false, message: "Staff member not found." };
  }

  const startTime = normalizeTime(parsed.data.startTime);
  const endTime = normalizeTime(parsed.data.endTime);
  if (startTime >= endTime) {
    return { success: false, message: "End time must be after start time." };
  }

  const { data, error } = await supabase
    .from("staff_shifts")
    .insert({
      clinic_id: staff.clinic_id,
      staff_id: parsed.data.staffId,
      shift_date: parsed.data.shiftDate,
      start_time: startTime,
      end_time: endTime,
      notes: normalizeOptionalString(parsed.data.notes),
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, message: "This staff member already has a shift at that time." };
    }
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "attendance.shift_scheduled",
    targetType: "staff_shift",
    targetId: data.id,
    details: {
      staffId: parsed.data.staffId,
      shiftDate: parsed.data.shiftDate,
      startTime,
      endTime,
    },
  });

  revalidateAttendancePaths();

  return {
    success: true,
    message: `Scheduled shift for ${targetStaff.full_name}.`,
    shiftId: data.id,
  };
}

export async function cancelShift(
  input: z.input<typeof cancelShiftSchema>
): Promise<AttendanceActionResult> {
  const parsed = cancelShiftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid shift.",
    };
  }

  const { supabase, staff, shift } = await getShiftRecord(parsed.data.shiftId);

  if (staff.role !== "admin") {
    return { success: false, message: "Only admins can cancel shifts." };
  }

  if (!canCancelShift(shift.status)) {
    return { success: false, message: "This shift cannot be cancelled." };
  }

  const { error } = await supabase
    .from("staff_shifts")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", shift.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "attendance.shift_cancelled",
    targetType: "staff_shift",
    targetId: shift.id,
  });

  revalidateAttendancePaths();

  return {
    success: true,
    message: "Shift cancelled.",
    shiftId: shift.id,
  };
}

export async function clockIn(
  input: z.input<typeof clockInSchema> = {}
): Promise<AttendanceActionResult> {
  const parsed = clockInSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid clock-in details.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ATTENDANCE_ROLES],
    module: "attendance",
  });

  const activeRecord = await getActiveAttendanceRecord(staff.id, staff.clinic_id);
  if (!canClockIn(activeRecord)) {
    return { success: false, message: "You are already clocked in." };
  }

  let shiftId: string | null = null;
  if (parsed.data.shiftId) {
    const { shift } = await getShiftRecord(parsed.data.shiftId);
    if (shift.staff_id !== staff.id && staff.role !== "admin") {
      return { success: false, message: "You can only clock in to your own shifts." };
    }
    if (shift.status !== "scheduled") {
      return { success: false, message: "This shift is no longer active." };
    }
    shiftId = shift.id;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("attendance_records")
    .insert({
      clinic_id: staff.clinic_id,
      staff_id: staff.id,
      shift_id: shiftId,
      clock_in_at: now,
      status: "clocked_in" as AttendanceStatus,
      notes: normalizeOptionalString(parsed.data.notes),
      recorded_by: staff.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, message: "You are already clocked in." };
    }
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "attendance.clocked_in",
    targetType: "attendance_record",
    targetId: data.id,
    details: { shiftId },
  });

  revalidateAttendancePaths();

  return {
    success: true,
    message: "Clocked in successfully.",
    recordId: data.id,
  };
}

export async function clockOut(
  input: z.input<typeof clockOutSchema> = {}
): Promise<AttendanceActionResult> {
  const parsed = clockOutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid clock-out details.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ATTENDANCE_ROLES],
    module: "attendance",
  });

  let record: AttendanceRecord;
  if (parsed.data.recordId) {
    const fetched = await getAttendanceRecord(parsed.data.recordId);
    if (fetched.record.staff_id !== staff.id && staff.role !== "admin") {
      return { success: false, message: "You can only clock out your own attendance." };
    }
    record = fetched.record;
  } else {
    const activeRecord = await getActiveAttendanceRecord(staff.id, staff.clinic_id);
    if (!activeRecord) {
      return { success: false, message: "You are not currently clocked in." };
    }
    record = activeRecord;
  }

  if (!canClockOut(record)) {
    return { success: false, message: "This attendance record is already closed." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("attendance_records")
    .update({
      clock_out_at: now,
      status: "clocked_out" as AttendanceStatus,
      notes: parsed.data.notes !== undefined ? normalizeOptionalString(parsed.data.notes) : undefined,
      updated_at: now,
    })
    .eq("id", record.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "attendance.clocked_out",
    targetType: "attendance_record",
    targetId: record.id,
  });

  revalidateAttendancePaths();

  return {
    success: true,
    message: "Clocked out successfully.",
    recordId: record.id,
  };
}

export async function createLeaveRequest(
  input: z.input<typeof createLeaveRequestSchema>
): Promise<AttendanceActionResult> {
  const parsed = createLeaveRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid leave request.",
    };
  }

  if (parsed.data.endDate < parsed.data.startDate) {
    return { success: false, message: "End date must be on or after start date." };
  }

  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ATTENDANCE_ROLES],
    module: "attendance",
  });

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      clinic_id: staff.clinic_id,
      staff_id: staff.id,
      leave_type: parsed.data.leaveType as LeaveType,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      reason: normalizeOptionalString(parsed.data.reason),
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "attendance.leave_requested",
    targetType: "leave_request",
    targetId: data.id,
    details: {
      leaveType: parsed.data.leaveType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    },
  });

  revalidateAttendancePaths();

  return {
    success: true,
    message: "Leave request submitted.",
    leaveId: data.id,
  };
}

export async function reviewLeaveRequest(
  input: z.input<typeof reviewLeaveSchema>
): Promise<AttendanceActionResult> {
  const parsed = reviewLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid leave review.",
    };
  }

  const { supabase, staff, leave } = await getLeaveRecord(parsed.data.leaveId);

  if (staff.role !== "admin") {
    return { success: false, message: "Only admins can review leave requests." };
  }

  if (!canReviewLeaveRequest(leave.status)) {
    return { success: false, message: "This leave request has already been reviewed." };
  }

  const now = new Date().toISOString();
  const nextStatus = parsed.data.status as LeaveStatus;
  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: nextStatus,
      reviewed_by: staff.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", leave.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "attendance.leave_reviewed",
    targetType: "leave_request",
    targetId: leave.id,
    details: { status: nextStatus },
  });

  revalidateAttendancePaths();

  return {
    success: true,
    message: `Leave request ${nextStatus}.`,
    leaveId: leave.id,
  };
}

export async function cancelLeaveRequest(
  input: z.input<typeof cancelLeaveSchema>
): Promise<AttendanceActionResult> {
  const parsed = cancelLeaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid leave request.",
    };
  }

  const { supabase, staff, leave } = await getLeaveRecord(parsed.data.leaveId);

  if (leave.staff_id !== staff.id && staff.role !== "admin") {
    return { success: false, message: "You can only cancel your own leave requests." };
  }

  if (!canCancelLeave(leave.status)) {
    return { success: false, message: "This leave request cannot be cancelled." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "cancelled" as LeaveStatus,
      updated_at: now,
    })
    .eq("id", leave.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "attendance.leave_cancelled",
    targetType: "leave_request",
    targetId: leave.id,
  });

  revalidateAttendancePaths();

  return {
    success: true,
    message: "Leave request cancelled.",
    leaveId: leave.id,
  };
}

export type ScheduleShiftInput = z.input<typeof scheduleShiftSchema>;
export type CreateLeaveRequestInput = z.input<typeof createLeaveRequestSchema>;
