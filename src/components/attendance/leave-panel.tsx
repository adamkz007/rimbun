"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { CalendarOff, Check, Plus, X } from "lucide-react";
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
import {
  cancelLeaveRequest,
  createLeaveRequest,
  reviewLeaveRequest,
} from "@/lib/actions/attendance-actions";
import {
  LEAVE_TYPES,
  canCancelLeave,
  canReviewLeaveRequest,
  countLeaveDays,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  leaveStatusBadgeVariant,
} from "@/lib/attendance";
import { toast } from "@/lib/toast";
import type { LeaveStatus, LeaveType, StaffRole } from "@/types/database";

type StaffSummary = {
  id: string;
  full_name: string;
  role: StaffRole;
};

export type LeavePanelItem = {
  id: string;
  staff_id: string;
  leave_type: LeaveType;
  status: LeaveStatus;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  staff: StaffSummary | StaffSummary[] | null;
};

type LeavePanelProps = {
  leaveRequests: LeavePanelItem[];
  currentStaffId: string;
  isAdmin: boolean;
};

export function LeavePanel({
  leaveRequests,
  currentStaffId,
  isAdmin,
}: LeavePanelProps) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<"mine" | "all" | "pending">(
    isAdmin ? "pending" : "mine"
  );

  const visibleRequests = leaveRequests.filter((request) => {
    if (viewFilter === "mine") {
      return request.staff_id === currentStaffId;
    }

    if (viewFilter === "pending") {
      return request.status === "pending";
    }

    return true;
  });

  const handleCreate = (formData: FormData) => {
    setCreateError(null);
    startTransition(async () => {
      const result = await createLeaveRequest({
        leaveType: String(formData.get("leaveType")) as LeaveType,
        startDate: String(formData.get("startDate")),
        endDate: String(formData.get("endDate")),
        reason: String(formData.get("reason") ?? ""),
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

  const handleReview = (leaveId: string, status: "approved" | "rejected") => {
    startTransition(async () => {
      const result = await reviewLeaveRequest({ leaveId, status });
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  };

  const handleCancel = (leaveId: string) => {
    startTransition(async () => {
      const result = await cancelLeaveRequest({ leaveId });
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
        <div className="min-w-44 space-y-1">
          <Label htmlFor="leave-view-filter">View</Label>
          <select
            id="leave-view-filter"
            value={viewFilter}
            onChange={(event) => setViewFilter(event.target.value as typeof viewFilter)}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="mine">My requests</option>
            {isAdmin ? <option value="pending">Pending approval</option> : null}
            {isAdmin ? <option value="all">All requests</option> : null}
          </select>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Request leave
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request leave</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leave-type">Leave type</Label>
                <select
                  id="leave-type"
                  name="leaveType"
                  required
                  defaultValue="annual"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  {LEAVE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getLeaveTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="leave-start">Start date</Label>
                  <Input id="leave-start" name="startDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-end">End date</Label>
                  <Input id="leave-end" name="endDate" type="date" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-reason">Reason</Label>
                <Textarea id="leave-reason" name="reason" rows={3} />
              </div>
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
              <Button type="submit" disabled={isPending}>
                Submit request
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {visibleRequests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No leave requests in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleRequests.map((request) => {
            const staffMember = getFirstRelation(request.staff);
            const days = countLeaveDays(request.start_date, request.end_date);
            const canReview = isAdmin && canReviewLeaveRequest(request.status);
            const canCancel =
              (request.staff_id === currentStaffId || isAdmin) &&
              canCancelLeave(request.status);

            return (
              <Card key={request.id}>
                <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{staffMember?.full_name ?? "Unknown staff"}</p>
                      <Badge variant={leaveStatusBadgeVariant(request.status)}>
                        {getLeaveStatusLabel(request.status)}
                      </Badge>
                      <Badge variant="outline">{getLeaveTypeLabel(request.leave_type)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(`${request.start_date}T00:00:00`), "dd MMM yyyy")} –{" "}
                      {format(new Date(`${request.end_date}T00:00:00`), "dd MMM yyyy")} · {days}{" "}
                      day{days === 1 ? "" : "s"}
                    </p>
                    {request.reason ? (
                      <p className="text-xs text-muted-foreground">{request.reason}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canReview ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleReview(request.id, "approved")}
                          disabled={isPending}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReview(request.id, "rejected")}
                          disabled={isPending}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(request.id)}
                        disabled={isPending}
                      >
                        <CalendarOff className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    ) : null}
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
