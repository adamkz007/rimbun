"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceBoard, type AttendanceBoardItem } from "@/components/attendance/attendance-board";
import { AttendanceReport, type AttendanceReportItem } from "@/components/attendance/attendance-report";
import { LeavePanel, type LeavePanelItem } from "@/components/attendance/leave-panel";
import { SchedulePanel, type SchedulePanelItem } from "@/components/attendance/schedule-panel";
import type { StaffRole } from "@/types/database";

type StaffSummary = {
  id: string;
  full_name: string;
  role: StaffRole;
};

type AttendanceWorkspaceProps = {
  staff: StaffSummary;
  isAdmin: boolean;
  activeRecord: AttendanceBoardItem | null;
  records: AttendanceBoardItem[];
  shifts: SchedulePanelItem[];
  leaveRequests: LeavePanelItem[];
  staffOptions: StaffSummary[];
  initialTab?: "attendance" | "schedule" | "leave" | "reports";
};

export function AttendanceWorkspace({
  staff,
  isAdmin,
  activeRecord,
  records,
  shifts,
  leaveRequests,
  staffOptions,
  initialTab = "attendance",
}: AttendanceWorkspaceProps) {
  const reportItems: AttendanceReportItem[] = records.map((record) => ({
    status: record.status,
    clock_in_at: record.clock_in_at,
    clock_out_at: record.clock_out_at,
  }));

  const reportShifts = shifts.map((shift) => ({ status: shift.status }));
  const reportLeave = leaveRequests.map((request) => ({
    status: request.status,
    leave_type: request.leave_type,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Clock in and out, view schedules, request leave, and track staffing visibility.
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="attendance">Today</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          {isAdmin ? <TabsTrigger value="reports">Reports</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <AttendanceBoard
            currentStaffId={staff.id}
            isAdmin={isAdmin}
            activeRecord={activeRecord}
            records={records}
            staffOptions={staffOptions}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <SchedulePanel
            shifts={shifts}
            staffOptions={staffOptions}
            currentStaffId={staff.id}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <LeavePanel
            leaveRequests={leaveRequests}
            currentStaffId={staff.id}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="reports" className="mt-4">
            <AttendanceReport
              records={reportItems}
              shifts={reportShifts}
              leaveRequests={reportLeave}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
