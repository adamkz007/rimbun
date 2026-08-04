import { AttendanceWorkspace } from "@/components/attendance/attendance-workspace";
import { requirePageAccess } from "@/lib/auth";
import {
  getWeekDateRange,
  localDateToEndIso,
  localDateToStartIso,
  sortAttendanceRecords,
  sortLeaveRequests,
  sortShifts,
} from "@/lib/attendance";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceBoardItem } from "@/components/attendance/attendance-board";

type AttendancePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const staff = await requirePageAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
    module: "attendance",
  });
  const params = await searchParams;
  const isAdmin = staff.role === "admin";
  const weekRange = getWeekDateRange();

  const supabase = await getSupabaseServerClient();

  const [recordsRes, shiftsRes, leaveRes, staffRes, activeRecordRes] = await Promise.all([
    supabase
      .from("attendance_records")
      .select(
        "id, staff_id, shift_id, clock_in_at, clock_out_at, status, notes, staff:staff_id(id, full_name, role)"
      )
      .eq("clinic_id", staff.clinic_id)
      .gte("clock_in_at", localDateToStartIso(weekRange.start))
      .lte("clock_in_at", localDateToEndIso(weekRange.end))
      .order("clock_in_at", { ascending: false })
      .limit(100),
    supabase
      .from("staff_shifts")
      .select(
        "id, staff_id, shift_date, start_time, end_time, status, notes, staff:staff_id(id, full_name, role)"
      )
      .eq("clinic_id", staff.clinic_id)
      .gte("shift_date", weekRange.start)
      .lte("shift_date", weekRange.end)
      .order("shift_date", { ascending: true })
      .limit(100),
    supabase
      .from("leave_requests")
      .select(
        "id, staff_id, leave_type, status, start_date, end_date, reason, created_at, staff:staff_id(id, full_name, role)"
      )
      .eq("clinic_id", staff.clinic_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("staff")
      .select("id, full_name, role")
      .eq("clinic_id", staff.clinic_id)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("attendance_records")
      .select(
        "id, staff_id, shift_id, clock_in_at, clock_out_at, status, notes, staff:staff_id(id, full_name, role)"
      )
      .eq("clinic_id", staff.clinic_id)
      .eq("staff_id", staff.id)
      .eq("status", "clocked_in")
      .maybeSingle(),
  ]);

  if (recordsRes.error) throw new Error(recordsRes.error.message);
  if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  if (leaveRes.error) throw new Error(leaveRes.error.message);
  if (staffRes.error) throw new Error(staffRes.error.message);
  if (activeRecordRes.error) throw new Error(activeRecordRes.error.message);

  const records = sortAttendanceRecords(recordsRes.data ?? []) as AttendanceBoardItem[];
  const activeRecord = (activeRecordRes.data as AttendanceBoardItem | null) ?? null;

  return (
    <AttendanceWorkspace
      staff={{
        id: staff.id,
        full_name: staff.full_name,
        role: staff.role,
      }}
      isAdmin={isAdmin}
      activeRecord={activeRecord}
      records={records}
      shifts={sortShifts(shiftsRes.data ?? [])}
      leaveRequests={sortLeaveRequests(leaveRes.data ?? [])}
      staffOptions={staffRes.data ?? []}
      initialTab={getTabParam(getSingleValue(params.tab))}
    />
  );
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getTabParam(value: string | undefined) {
  if (value === "schedule" || value === "leave" || value === "reports") {
    return value;
  }

  return "attendance" as const;
}
