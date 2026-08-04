import type {
  EnquirySource,
  EnquiryStatus,
  NotificationChannel,
  ReminderStatus,
  ReminderType,
  StaffRole,
} from "@/types/database";

export const ENQUIRY_SOURCES: EnquirySource[] = [
  "call",
  "walk_in",
  "follow_up",
  "appointment",
];

export const ENQUIRY_STATUSES: EnquiryStatus[] = [
  "new",
  "in_progress",
  "scheduled",
  "converted",
  "closed",
  "cancelled",
];

export const ACTIVE_ENQUIRY_STATUSES: EnquiryStatus[] = [
  "new",
  "in_progress",
  "scheduled",
];

export const REMINDER_TYPES: ReminderType[] = [
  "follow_up",
  "appointment",
  "callback",
];

export const REMINDER_STATUSES: ReminderStatus[] = [
  "pending",
  "sent",
  "dismissed",
  "failed",
];

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  "in_app",
  "email",
  "sms",
];

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  call: "Phone call",
  walk_in: "Walk-in",
  follow_up: "Follow-up",
  appointment: "Appointment",
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  in_progress: "In progress",
  scheduled: "Scheduled",
  converted: "Converted",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  follow_up: "Follow-up",
  appointment: "Appointment",
  callback: "Callback",
};

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  dismissed: "Dismissed",
  failed: "Failed",
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "In-app",
  email: "Email",
  sms: "SMS",
};

export function getEnquirySourceLabel(source: EnquirySource) {
  return ENQUIRY_SOURCE_LABELS[source];
}

export function getEnquiryStatusLabel(status: EnquiryStatus) {
  return ENQUIRY_STATUS_LABELS[status];
}

export function getReminderTypeLabel(type: ReminderType) {
  return REMINDER_TYPE_LABELS[type];
}

export function getReminderStatusLabel(status: ReminderStatus) {
  return REMINDER_STATUS_LABELS[status];
}

export function getNotificationChannelLabel(channel: NotificationChannel) {
  return NOTIFICATION_CHANNEL_LABELS[channel];
}

export function enquiryStatusBadgeVariant(
  status: EnquiryStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "converted":
      return "default";
    case "scheduled":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function reminderStatusBadgeVariant(
  status: ReminderStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "sent":
      return "default";
    case "dismissed":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function canAccessEnquiry(role: StaffRole) {
  return role === "admin" || role === "receptionist";
}

export function canManageEnquiry(role: StaffRole) {
  return role === "admin" || role === "receptionist";
}

export function canConvertEnquiry(status: EnquiryStatus) {
  return ACTIVE_ENQUIRY_STATUSES.includes(status);
}

export function canEditEnquiry(status: EnquiryStatus) {
  return ACTIVE_ENQUIRY_STATUSES.includes(status);
}

export function canCloseEnquiry(status: EnquiryStatus) {
  return ACTIVE_ENQUIRY_STATUSES.includes(status);
}

export function canCancelEnquiry(status: EnquiryStatus) {
  return ACTIVE_ENQUIRY_STATUSES.includes(status);
}

export function canScheduleReminder(status: EnquiryStatus) {
  return status !== "cancelled" && status !== "closed" && status !== "converted";
}

export function canDismissReminder(status: ReminderStatus) {
  return status === "pending" || status === "sent";
}

export function isActiveEnquiryStatus(status: EnquiryStatus) {
  return ACTIVE_ENQUIRY_STATUSES.includes(status);
}

export function isReminderDue(remindAt: string | Date, now: Date = new Date()) {
  const dueAt = remindAt instanceof Date ? remindAt : new Date(remindAt);
  return dueAt.getTime() <= now.getTime();
}

export function isReminderUpcoming(
  remindAt: string | Date,
  now: Date = new Date(),
  withinHours = 24
) {
  const dueAt = remindAt instanceof Date ? remindAt : new Date(remindAt);
  const windowEnd = now.getTime() + withinHours * 60 * 60 * 1000;
  return dueAt.getTime() > now.getTime() && dueAt.getTime() <= windowEnd;
}

export function deriveEnquiryStatusAfterSchedule(currentStatus: EnquiryStatus) {
  if (currentStatus === "new" || currentStatus === "in_progress") {
    return "scheduled" as const;
  }

  return currentStatus;
}

export function buildEnquirySummary(input: {
  contactName: string;
  source: EnquirySource;
  subject?: string | null;
}) {
  const subject = input.subject?.trim();
  if (subject) {
    return `${input.contactName} — ${subject}`;
  }

  return `${input.contactName} (${getEnquirySourceLabel(input.source)})`;
}

export function sortEnquiries<
  T extends { created_at: string; status: EnquiryStatus; scheduled_at?: string | null }
>(enquiries: T[]) {
  const statusOrder: Record<EnquiryStatus, number> = {
    new: 0,
    in_progress: 1,
    scheduled: 2,
    converted: 3,
    closed: 4,
    cancelled: 5,
  };

  return [...enquiries].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (left.scheduled_at && right.scheduled_at) {
      return new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime();
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function sortReminders<
  T extends { remind_at: string; status: ReminderStatus }
>(reminders: T[]) {
  const statusOrder: Record<ReminderStatus, number> = {
    pending: 0,
    sent: 1,
    failed: 2,
    dismissed: 3,
  };

  return [...reminders].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    return new Date(left.remind_at).getTime() - new Date(right.remind_at).getTime();
  });
}

export function summarizeEnquiryReport(
  enquiries: Array<{ status: EnquiryStatus; source: EnquirySource }>
) {
  const byStatus = ENQUIRY_STATUSES.reduce<Record<EnquiryStatus, number>>(
    (totals, status) => {
      totals[status] = 0;
      return totals;
    },
    {
      new: 0,
      in_progress: 0,
      scheduled: 0,
      converted: 0,
      closed: 0,
      cancelled: 0,
    }
  );

  const bySource = ENQUIRY_SOURCES.reduce<Record<EnquirySource, number>>(
    (totals, source) => {
      totals[source] = 0;
      return totals;
    },
    {
      call: 0,
      walk_in: 0,
      follow_up: 0,
      appointment: 0,
    }
  );

  for (const enquiry of enquiries) {
    byStatus[enquiry.status] += 1;
    bySource[enquiry.source] += 1;
  }

  return {
    total: enquiries.length,
    active: byStatus.new + byStatus.in_progress + byStatus.scheduled,
    converted: byStatus.converted,
    byStatus,
    bySource,
  };
}

export function filterDueReminders<
  T extends { remind_at: string; status: ReminderStatus }
>(reminders: T[], now: Date = new Date()) {
  return reminders.filter(
    (reminder) =>
      reminder.status === "pending" && isReminderDue(reminder.remind_at, now)
  );
}

export function filterUpcomingReminders<
  T extends { remind_at: string; status: ReminderStatus }
>(reminders: T[], now: Date = new Date(), withinHours = 24) {
  return reminders.filter(
    (reminder) =>
      reminder.status === "pending" &&
      isReminderUpcoming(reminder.remind_at, now, withinHours)
  );
}
