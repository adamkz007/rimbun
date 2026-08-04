"use client";

import { useDeferredValue, useState, useTransition } from "react";
import { format } from "date-fns";
import { Clock, LogIn, LogOut, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clockIn, clockOut } from "@/lib/actions/attendance-actions";
import {
  attendanceStatusBadgeVariant,
  calculateWorkedMinutes,
  formatWorkedDuration,
  getAttendanceStatusLabel,
} from "@/lib/attendance";
import { toast } from "@/lib/toast";
import type { AttendanceStatus, StaffRole } from "@/types/database";

type StaffSummary = {
  id: string;
  full_name: string;
  role: StaffRole;
};

export type AttendanceBoardItem = {
  id: string;
  staff_id: string;
  shift_id: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  status: AttendanceStatus;
  notes: string | null;
  staff: StaffSummary | StaffSummary[] | null;
};

type AttendanceBoardProps = {
  currentStaffId: string;
  isAdmin: boolean;
  activeRecord: AttendanceBoardItem | null;
  records: AttendanceBoardItem[];
  staffOptions: StaffSummary[];
};

export function AttendanceBoard({
  currentStaffId,
  isAdmin,
  activeRecord,
  records,
  staffOptions,
}: AttendanceBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [staffFilter, setStaffFilter] = useState<string>(isAdmin ? "all" : currentStaffId);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredRecords = records.filter((record) => {
    if (staffFilter !== "all" && record.staff_id !== staffFilter) {
      return false;
    }

    if (!deferredQuery) {
      return true;
    }

    const staffMember = getFirstRelation(record.staff);
    const haystack = [staffMember?.full_name, record.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(deferredQuery);
  });

  const handleClockIn = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await clockIn({ notes: notes || undefined });
      if (!result.success) {
        setActionError(result.message);
        toast.error(result.message);
        return;
      }

      setNotes("");
      toast.success(result.message);
    });
  };

  const handleClockOut = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await clockOut({ notes: notes || undefined });
      if (!result.success) {
        setActionError(result.message);
        toast.error(result.message);
        return;
      }

      setNotes("");
      toast.success(result.message);
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">
                  {activeRecord ? "You are clocked in" : "You are off duty"}
                </p>
              </div>
              {activeRecord ? (
                <p className="text-sm text-muted-foreground">
                  Since {format(new Date(activeRecord.clock_in_at), "h:mm a")} ·{" "}
                  {formatWorkedDuration(
                    calculateWorkedMinutes({
                      clockInAt: activeRecord.clock_in_at,
                    })
                  )}{" "}
                  elapsed
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Clock in when your shift starts.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {activeRecord ? (
                <Button onClick={handleClockOut} disabled={isPending}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Clock out
                </Button>
              ) : (
                <Button onClick={handleClockIn} disabled={isPending}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Clock in
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendance-notes">Notes (optional)</Label>
            <Textarea
              id="attendance-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Late arrival, remote start, etc."
              rows={2}
            />
          </div>

          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {isAdmin ? (
          <div className="min-w-44 space-y-1">
            <Label htmlFor="attendance-staff-filter">Staff member</Label>
            <select
              id="attendance-staff-filter"
              value={staffFilter}
              onChange={(event) => setStaffFilter(event.target.value)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="all">All staff</option>
              {staffOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search attendance records..."
            className="pl-9"
          />
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No attendance records match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRecords.map((record) => {
            const staffMember = getFirstRelation(record.staff);
            const workedMinutes = calculateWorkedMinutes({
              clockInAt: record.clock_in_at,
              clockOutAt: record.clock_out_at,
            });

            return (
              <Card key={record.id}>
                <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{staffMember?.full_name ?? "Unknown staff"}</p>
                      <Badge variant={attendanceStatusBadgeVariant(record.status)}>
                        {getAttendanceStatusLabel(record.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(record.clock_in_at), "dd MMM yyyy, h:mm a")}
                      {record.clock_out_at
                        ? ` – ${format(new Date(record.clock_out_at), "h:mm a")}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Duration {formatWorkedDuration(workedMinutes)}
                      {record.notes ? ` · ${record.notes}` : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
