"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Bell, BellRing, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  dismissReminder,
  processDueReminders,
} from "@/lib/actions/enquiry-actions";
import {
  getNotificationChannelLabel,
  getReminderStatusLabel,
  getReminderTypeLabel,
  isReminderDue,
  reminderStatusBadgeVariant,
} from "@/lib/enquiry";
import { toast } from "@/lib/toast";
import type { NotificationChannel, ReminderStatus, ReminderType } from "@/types/database";

type EnquirySummary = {
  id: string;
  contact_name: string;
  subject: string | null;
  source: string;
};

export type ReminderPanelItem = {
  id: string;
  reminder_type: ReminderType;
  status: ReminderStatus;
  notification_channel: NotificationChannel;
  remind_at: string;
  message: string | null;
  sent_at: string | null;
  enquiries:
    | EnquirySummary
    | EnquirySummary[]
    | null;
};

type ReminderPanelProps = {
  reminders: ReminderPanelItem[];
};

export function ReminderPanel({ reminders }: ReminderPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const dueCount = reminders.filter(
    (reminder) => reminder.status === "pending" && isReminderDue(reminder.remind_at)
  ).length;

  function handleDismiss(reminderId: string) {
    startTransition(async () => {
      const result = await dismissReminder({ reminderId });
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  function handleProcessDue() {
    startTransition(async () => {
      const result = await processDueReminders();
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {dueCount > 0
              ? `${dueCount} reminder${dueCount === 1 ? "" : "s"} due now`
              : "No reminders due right now"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || dueCount === 0}
          onClick={handleProcessDue}
        >
          <BellRing className="mr-2 h-4 w-4" />
          Process due reminders
        </Button>
      </div>

      {reminders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No reminders scheduled yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder) => {
            const enquiry = getFirstRelation(reminder.enquiries);
            const due = reminder.status === "pending" && isReminderDue(reminder.remind_at);

            return (
              <Card key={reminder.id} className={due ? "border-amber-500/60" : undefined}>
                <CardContent className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {enquiry?.contact_name ?? "Unknown enquiry"}
                      </p>
                      <Badge variant={reminderStatusBadgeVariant(reminder.status)}>
                        {getReminderStatusLabel(reminder.status)}
                      </Badge>
                      {due ? (
                        <Badge variant="destructive">
                          <Bell className="mr-1 h-3 w-3" />
                          Due
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {reminder.message ??
                        enquiry?.subject ??
                        getReminderTypeLabel(reminder.reminder_type)}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{getReminderTypeLabel(reminder.reminder_type)}</span>
                      <span>{getNotificationChannelLabel(reminder.notification_channel)}</span>
                      <span>{format(new Date(reminder.remind_at), "dd MMM yyyy, h:mm a")}</span>
                      {reminder.sent_at ? (
                        <span>Sent {format(new Date(reminder.sent_at), "dd MMM yyyy, h:mm a")}</span>
                      ) : null}
                    </div>
                  </div>

                  {reminder.status === "pending" || reminder.status === "sent" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleDismiss(reminder.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Dismiss
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
