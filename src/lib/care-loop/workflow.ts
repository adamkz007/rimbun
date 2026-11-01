import type { StaffRole } from "@/types/database";
import type { Urgency } from "./catalogue.ts";

// A case opens when a doctor marks a result actionable and moves forward
// through these steps. Every open step has one owner and a due date.

export const CASE_STATES = [
  "triaged",
  "notified",
  "acknowledged",
  "confirmed",
  "referred",
  "accepted",
  "attended",
  "in_care",
  "closed",
] as const;
export type CaseState = (typeof CASE_STATES)[number];

export const CASE_STATE_LABELS: Record<CaseState, string> = {
  triaged: "Triaged",
  notified: "Notified",
  acknowledged: "Acknowledged",
  confirmed: "Confirmed",
  referred: "Referred",
  accepted: "Accepted",
  attended: "Attended",
  in_care: "Treatment / surveillance",
  closed: "Closed",
};

/** What has to happen next for a case sitting in each state. */
export const NEXT_ACTION_LABELS: Record<CaseState, string> = {
  triaged: "Notify the patient",
  notified: "Get the patient's acknowledgement",
  acknowledged: "Confirm, refer or book a review",
  confirmed: "Refer or book a review",
  referred: "Get the referral accepted",
  accepted: "Patient attends the appointment",
  attended: "Record the care plan",
  in_care: "Close with evidence",
  closed: "No action needed",
};

const HOUR = 60 * 60 * 1000;

/**
 * Fixed default service levels (hours allowed in each state) by urgency.
 * Calendar hours, not working days. Per-pathway overrides come later.
 */
export const SLA_HOURS: Record<Exclude<CaseState, "closed">, Record<Urgency, number>> = {
  triaged: { critical: 8, urgent: 24, soon: 120, routine: 240 },
  notified: { critical: 8, urgent: 72, soon: 72, routine: 72 },
  acknowledged: { critical: 24, urgent: 48, soon: 168, routine: 336 },
  confirmed: { critical: 24, urgent: 48, soon: 168, routine: 336 },
  referred: { critical: 24, urgent: 120, soon: 120, routine: 120 },
  accepted: { critical: 48, urgent: 168, soon: 720, routine: 2160 },
  attended: { critical: 168, urgent: 168, soon: 168, routine: 168 },
  in_care: { critical: 336, urgent: 336, soon: 336, routine: 336 },
};

/** Reminder points after a patient is notified, in hours. */
export const REMINDER_AFTER_HOURS = [24, 72] as const;

/** Contact attempts without acknowledgement before a doctor must decide. */
export const UNREACHABLE_AFTER_ATTEMPTS = 3;

export function stateIndex(state: CaseState) {
  return CASE_STATES.indexOf(state);
}

export function isOpenState(state: CaseState) {
  return state !== "closed";
}

export function computeDueAt(state: CaseState, urgency: Urgency, enteredAt: Date | string) {
  if (state === "closed") return null;
  const start = enteredAt instanceof Date ? enteredAt : new Date(enteredAt);
  return new Date(start.getTime() + SLA_HOURS[state][urgency] * HOUR);
}

/** Staff can move a case forward to any later open state, never backwards. */
export function canAdvanceTo(current: CaseState, next: CaseState) {
  if (next === "closed" || current === "closed") return false;
  return stateIndex(next) > stateIndex(current);
}

export type EscalationTier = "none" | "owner" | "doctor" | "admin";

export const ESCALATION_LABELS: Record<EscalationTier, string> = {
  none: "On track",
  owner: "Overdue: owner",
  doctor: "Escalated to doctor",
  admin: "Escalated to clinic admin",
};

/**
 * Who should be chasing an overdue step: the owner first, then a doctor after
 * 24 hours overdue, then the clinic admin after 72 hours. Critical cases go
 * straight to a doctor as soon as they are overdue.
 */
export function escalationTier(
  dueAt: Date | string | null,
  urgency: Urgency,
  now: Date = new Date()
): EscalationTier {
  if (!dueAt) return "none";
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const overdueMs = now.getTime() - due.getTime();
  if (overdueMs <= 0) return "none";
  if (overdueMs >= 72 * HOUR) return "admin";
  if (overdueMs >= 24 * HOUR || urgency === "critical") return "doctor";
  return "owner";
}

export function needsDoctorDecision(input: {
  state: CaseState;
  contactAttempts: number;
}) {
  return (
    (input.state === "triaged" || input.state === "notified") &&
    input.contactAttempts >= UNREACHABLE_AFTER_ATTEMPTS
  );
}

export function nextReminderDue(notifiedAt: Date | string, remindersSent: number) {
  const offset = REMINDER_AFTER_HOURS[remindersSent];
  if (offset === undefined) return null;
  const start = notifiedAt instanceof Date ? notifiedAt : new Date(notifiedAt);
  return new Date(start.getTime() + offset * HOUR);
}

// ---- Closure ----

export const CLOSURE_REASONS = [
  "completed",
  "resolved_on_repeat",
  "care_elsewhere",
  "declined",
  "lost_to_follow_up",
  "deceased",
] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export const CLOSURE_REASON_LABELS: Record<ClosureReason, string> = {
  completed: "Care completed (evidence attached)",
  resolved_on_repeat: "Repeat test normal",
  care_elsewhere: "Care confirmed elsewhere",
  declined: "Patient declined",
  lost_to_follow_up: "Lost to follow-up",
  deceased: "Deceased",
};

/** Reasons that rest on documented evidence rather than a doctor's sign-off. */
const EVIDENCE_REASONS: ClosureReason[] = ["completed"];

export function closureRequiresSignOff(reason: ClosureReason) {
  return !EVIDENCE_REASONS.includes(reason);
}

export function checkClosure(input: {
  role: StaffRole;
  state: CaseState;
  reason: ClosureReason;
  note: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.state === "closed") {
    return { ok: false, error: "This case is already closed." };
  }

  if (!input.note.trim()) {
    return { ok: false, error: "Add a closure note describing the evidence or decision." };
  }

  if (input.reason === "completed") {
    if (input.role !== "doctor" && input.role !== "nurse") {
      return { ok: false, error: "Only clinical staff can close a case." };
    }
    if (stateIndex(input.state) < stateIndex("attended")) {
      return {
        ok: false,
        error: "Care can only be marked completed after the patient has attended.",
      };
    }
    return { ok: true };
  }

  if (input.reason === "resolved_on_repeat" && stateIndex(input.state) < stateIndex("confirmed")) {
    return { ok: false, error: "Record the repeat test (Confirmed) before closing on it." };
  }

  if (input.role !== "doctor") {
    return { ok: false, error: "Only a doctor can close a case without care evidence." };
  }

  return { ok: true };
}

// ---- Permissions ----

export function canEnterResults(role: StaffRole) {
  return ["admin", "doctor", "nurse", "receptionist"].includes(role);
}

export function canTriageResults(role: StaffRole) {
  return role === "doctor";
}

export function canContactPatients(role: StaffRole) {
  return role === "doctor" || role === "nurse" || role === "receptionist";
}

export function canProgressCases(role: StaffRole) {
  return role === "doctor" || role === "nurse";
}

export function canCreateReferrals(role: StaffRole) {
  return role === "doctor";
}

export function canReassignCases(role: StaffRole) {
  return role === "doctor" || role === "nurse" || role === "admin";
}

export function canReopenCases(role: StaffRole) {
  return role === "doctor";
}

// ---- Worklists ----

export const WORKLISTS = [
  "triage",
  "mine",
  "overdue",
  "awaiting_patient",
  "referral_rejected",
  "open",
  "closed",
] as const;
export type Worklist = (typeof WORKLISTS)[number];

export const WORKLIST_LABELS: Record<Worklist, string> = {
  triage: "To triage",
  mine: "My cases",
  overdue: "Overdue",
  awaiting_patient: "Awaiting patient",
  referral_rejected: "Referral rejected",
  open: "All open",
  closed: "Closed",
};

export type WorklistCase = {
  state: CaseState;
  owner_staff_id: string;
  current_step_due_at: string | null;
  referral_rejected: boolean;
};

export function isOverdue(item: Pick<WorklistCase, "state" | "current_step_due_at">, now = new Date()) {
  return (
    isOpenState(item.state) &&
    !!item.current_step_due_at &&
    new Date(item.current_step_due_at).getTime() < now.getTime()
  );
}

export function matchesWorklist(
  item: WorklistCase,
  worklist: Exclude<Worklist, "triage">,
  staffId: string,
  now = new Date()
) {
  switch (worklist) {
    case "mine":
      return isOpenState(item.state) && item.owner_staff_id === staffId;
    case "overdue":
      return isOverdue(item, now);
    case "awaiting_patient":
      return item.state === "notified";
    case "referral_rejected":
      return isOpenState(item.state) && item.referral_rejected;
    case "open":
      return isOpenState(item.state);
    case "closed":
      return item.state === "closed";
  }
}
