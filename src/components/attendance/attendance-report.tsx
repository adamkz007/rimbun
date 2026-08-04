"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ATTENDANCE_STATUSES,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  formatWorkedDuration,
  getAttendanceStatusLabel,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  summarizeAttendanceReport,
} from "@/lib/attendance";
import type { AttendanceStatus, LeaveStatus, LeaveType, ShiftStatus } from "@/types/database";

export type AttendanceReportItem = {
  status: AttendanceStatus;
  clock_in_at: string;
  clock_out_at?: string | null;
};

type AttendanceReportProps = {
  records: AttendanceReportItem[];
  shifts: Array<{ status: ShiftStatus }>;
  leaveRequests: Array<{ status: LeaveStatus; leave_type: LeaveType }>;
};

export function AttendanceReport({
  records,
  shifts,
  leaveRequests,
}: AttendanceReportProps) {
  const report = summarizeAttendanceReport({ records, shifts, leaveRequests });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On duty now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.onDuty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scheduled shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.scheduledShifts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending leave</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.pendingLeave}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hours logged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatWorkedDuration(report.totalWorkedMinutes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By attendance status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ATTENDANCE_STATUSES.map((status) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span>{getAttendanceStatusLabel(status)}</span>
                <span className="font-medium">{report.byAttendanceStatus[status]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By leave status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {LEAVE_STATUSES.map((status) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span>{getLeaveStatusLabel(status)}</span>
                <span className="font-medium">{report.byLeaveStatus[status]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave by type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {LEAVE_TYPES.map((type) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span>{getLeaveTypeLabel(type)}</span>
              <span className="font-medium">{report.byLeaveType[type]}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
