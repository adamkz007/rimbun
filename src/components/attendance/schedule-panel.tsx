"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { CalendarPlus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelShift, scheduleShift } from "@/lib/actions/attendance-actions";
import {
  canCancelShift,
  formatShiftTime,
  getShiftStatusLabel,
} from "@/lib/attendance";
import { toast } from "@/lib/toast";
import type { ShiftStatus, StaffRole } from "@/types/database";

type StaffSummary = {
  id: string;
  full_name: string;
  role: StaffRole;
};

export type SchedulePanelItem = {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  notes: string | null;
  staff: StaffSummary | StaffSummary[] | null;
};

type SchedulePanelProps = {
  shifts: SchedulePanelItem[];
  staffOptions: StaffSummary[];
  currentStaffId: string;
  isAdmin: boolean;
};

export function SchedulePanel({
  shifts,
  staffOptions,
  currentStaffId,
  isAdmin,
}: SchedulePanelProps) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState<string>(isAdmin ? "all" : currentStaffId);

  const visibleShifts = shifts.filter((shift) => {
    if (staffFilter === "all") {
      return true;
    }

    return shift.staff_id === staffFilter;
  });

  const handleSchedule = (formData: FormData) => {
    setCreateError(null);
    startTransition(async () => {
      const result = await scheduleShift({
        staffId: String(formData.get("staffId")),
        shiftDate: String(formData.get("shiftDate")),
        startTime: String(formData.get("startTime")),
        endTime: String(formData.get("endTime")),
        notes: String(formData.get("notes") ?? ""),
      });

      if (!result.success) {
        setCreateError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setCreateOpen(false);
    });
  };

  const handleCancel = (shiftId: string) => {
    startTransition(async () => {
      const result = await cancelShift({ shiftId });
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {isAdmin ? (
          <div className="min-w-44 space-y-1">
            <Label htmlFor="schedule-staff-filter">Staff member</Label>
            <select
              id="schedule-staff-filter"
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

        {isAdmin ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button />}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Schedule shift
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule shift</DialogTitle>
              </DialogHeader>
              <form action={handleSchedule} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-staff">Staff member</Label>
                  <select
                    id="schedule-staff"
                    name="staffId"
                    required
                    defaultValue={staffOptions[0]?.id ?? ""}
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    {staffOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-date">Shift date</Label>
                  <Input id="schedule-date" name="shiftDate" type="date" required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-start">Start time</Label>
                    <Input id="schedule-start" name="startTime" type="time" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-end">End time</Label>
                    <Input id="schedule-end" name="endTime" type="time" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-notes">Notes</Label>
                  <Textarea id="schedule-notes" name="notes" rows={2} />
                </div>
                {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
                <Button type="submit" disabled={isPending}>
                  Save shift
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {visibleShifts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No scheduled shifts for the selected view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleShifts.map((shift) => {
            const staffMember = getFirstRelation(shift.staff);
            const canCancel = isAdmin && canCancelShift(shift.status);

            return (
              <Card key={shift.id}>
                <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{staffMember?.full_name ?? "Unknown staff"}</p>
                      <Badge variant={shift.status === "scheduled" ? "outline" : "secondary"}>
                        {getShiftStatusLabel(shift.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(`${shift.shift_date}T00:00:00`), "EEE, dd MMM yyyy")} ·{" "}
                      {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                    </p>
                    {shift.notes ? (
                      <p className="text-xs text-muted-foreground">{shift.notes}</p>
                    ) : null}
                  </div>

                  {canCancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(shift.id)}
                      disabled={isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  ) : null}
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
