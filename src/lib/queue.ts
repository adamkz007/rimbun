import type { QueueArrivalType, QueueStatus, StaffRole } from "@/types/database";

export const QUEUE_STATUSES: QueueStatus[] = [
  "waiting",
  "with_nurse",
  "with_doctor",
  "completed",
  "cancelled",
];

export const ACTIVE_QUEUE_STATUSES: QueueStatus[] = ["waiting", "with_nurse", "with_doctor"];

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: "Waiting",
  with_nurse: "With nurse",
  with_doctor: "With doctor",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const QUEUE_ARRIVAL_LABELS: Record<QueueArrivalType, string> = {
  walk_in: "Walk-in",
  appointment: "Appointment",
};

export function formatQueueNumber(queueNumber: number) {
  return String(queueNumber).padStart(3, "0");
}

export function isActiveQueueStatus(status: QueueStatus) {
  return ACTIVE_QUEUE_STATUSES.includes(status);
}

export function getQueueStatusLabel(status: QueueStatus) {
  return QUEUE_STATUS_LABELS[status];
}

export function formatWaitDuration(checkedInAt: string | Date, now: Date = new Date()) {
  const startedAt = checkedInAt instanceof Date ? checkedInAt : new Date(checkedInAt);
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
  const totalMinutes = Math.floor(elapsedMs / 60_000);

  if (totalMinutes < 1) {
    return "< 1 min";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

export function canCheckInPatients(role: StaffRole) {
  return role === "admin" || role === "receptionist";
}

export function canManageQueueOrder(role: StaffRole) {
  return role === "admin" || role === "receptionist";
}

export function canCancelQueueEntry(role: StaffRole) {
  return role === "admin" || role === "receptionist";
}

export function canStartEncounterFromQueue(role: StaffRole) {
  return role === "doctor";
}

export function canUpdateQueueStatus(
  role: StaffRole,
  currentStatus: QueueStatus,
  nextStatus: QueueStatus
) {
  if (!isActiveQueueStatus(currentStatus) || !isActiveQueueStatus(nextStatus)) {
    return false;
  }

  if (role === "admin") {
    return true;
  }

  if (role === "receptionist") {
    return nextStatus === "waiting" || nextStatus === "cancelled";
  }

  if (role === "nurse") {
    return (
      (currentStatus === "waiting" && nextStatus === "with_nurse") ||
      (currentStatus === "with_nurse" && nextStatus === "waiting")
    );
  }

  if (role === "doctor") {
    return currentStatus === "with_nurse" && nextStatus === "with_doctor";
  }

  return false;
}

export function sortQueueEntries<T extends { sort_order: number; checked_in_at: string }>(
  entries: T[]
) {
  return [...entries].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return new Date(left.checked_in_at).getTime() - new Date(right.checked_in_at).getTime();
  });
}

export function getTodayUtcBounds(reference = new Date()) {
  const start = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate()
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
