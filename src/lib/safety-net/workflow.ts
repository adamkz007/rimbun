import type { PatientLanguage } from "../care-loop/catalogue.ts";
import type { StaffRole } from "@/types/database";
import {
  amberText,
  freeTextAck,
  greenText,
  introText,
  openerText,
  redFlagText,
  type MessageContext,
} from "./messages.ts";
import {
  getQuestion,
  OPENER_LABELS,
  OPENER_VALUES,
  type OpenerValue,
  type Protocol,
  type Route,
} from "./protocols.ts";

// The safety-net follow-up lifecycle, as pure functions so every rule can be
// tested without a database. The server layer persists what these return.
//
// Rules that matter for safety:
// - A red answer escalates at once: emergency advice to the patient, a doctor
//   alert, and no further questions.
// - The worst answer decides the route. "Better" on its own never closes a
//   follow-up; it closes only when every question has been answered green.
// - Silence is not "fine": no reply, or an unfinished set, becomes a nurse call.
// - Any typed message reaches a person, even after the follow-up has closed.
// - Taps on old questions, or after closure, change nothing.

export const FOLLOWUP_STATES = [
  "scheduled",
  "awaiting_reply",
  "answering",
  "needs_call",
  "escalated",
  "closed",
] as const;
export type FollowupState = (typeof FOLLOWUP_STATES)[number];

export const STATE_LABELS: Record<FollowupState, string> = {
  scheduled: "Scheduled",
  awaiting_reply: "Waiting for reply",
  answering: "Patient answering",
  needs_call: "Nurse to call",
  escalated: "Doctor alerted",
  closed: "Closed",
};

export const CALL_REASONS = ["amber", "no_reply", "incomplete", "patient_message"] as const;
export type CallReason = (typeof CALL_REASONS)[number];

export const CALL_REASON_LABELS: Record<CallReason, string> = {
  amber: "Answers need a check",
  no_reply: "No reply",
  incomplete: "Stopped part-way",
  patient_message: "Patient sent a message",
};

export const CLOSURE_REASONS = [
  "improved",
  "review_booked",
  "blood_test",
  "sent_to_emergency",
  "unreachable",
  "cancelled",
] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export const CLOSURE_REASON_LABELS: Record<ClosureReason, string> = {
  improved: "Improving (patient-reported)",
  review_booked: "Clinic review booked",
  blood_test: "Sent for blood test",
  sent_to_emergency: "Sent to emergency",
  unreachable: "Unreachable",
  cancelled: "Cancelled before check-in",
};

export const OPENER_ID = "opener";

/** Hours a patient has to reply before a nurse is asked to call. */
export const NO_REPLY_HOURS = 6;
export const CALL_DUE_HOURS = 2;
export const PATIENT_MESSAGE_DUE_HOURS = 1;
export const ESCALATION_DUE_MINUTES = 15;
export const UNREACHABLE_AFTER_CALLS = 3;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const ROUTE_RANK: Record<Route, number> = { green: 0, amber: 1, red: 2 };

export function worstRoute(routes: Route[]): Route | null {
  if (routes.length === 0) return null;
  return routes.reduce((worst, route) => (ROUTE_RANK[route] > ROUTE_RANK[worst] ? route : worst));
}

/** The follow-up fields the lifecycle reads. */
export type FollowupSnapshot = {
  state: FollowupState;
  question_ids: string[];
  answers: Record<string, string>;
  language: PatientLanguage;
  current_step_due_at: string | null;
  closed_at: string | null;
};

/** The follow-up fields the lifecycle may write. */
export type FollowupPatch = Partial<{
  state: FollowupState;
  answers: Record<string, string>;
  route: Route | null;
  current_step_due_at: string | null;
  sent_at: string;
  responded_at: string;
  completed_at: string;
  escalated_at: string;
  call_reason: CallReason | null;
  closed_at: string | null;
  closed_by: string | null;
  closure_reason: ClosureReason | null;
  closure_note: string | null;
}>;

export type OutboundMessage =
  | { kind: "template" | "question"; body: string; questionId: string; options: Array<{ value: string; label: string }> }
  | { kind: "text"; body: string };

export type LifecycleEvent = { type: string; note?: string | null; data?: Record<string, unknown> };

export type Outcome = {
  patch: FollowupPatch;
  outbound: OutboundMessage[];
  events: LifecycleEvent[];
};

export type Ignored = { ignored: "stale" | "closed" | "unknown_option" | "empty" };

export type InboundReply =
  | { kind: "button"; questionId: string; value: string }
  | { kind: "text"; text: string };

function at(now: Date, offsetMs = 0) {
  return new Date(now.getTime() + offsetMs).toISOString();
}

/** All answer routes so far, opener included. */
export function routeOfAnswers(protocol: Protocol, answers: Record<string, string>): Route | null {
  const routes: Route[] = [];
  for (const [questionId, value] of Object.entries(answers)) {
    if (questionId === OPENER_ID) {
      if ((OPENER_VALUES as readonly string[]).includes(value)) {
        routes.push(protocol.openerRoutes[value as OpenerValue]);
      }
      continue;
    }
    const option = getQuestion(protocol, questionId)?.options.find((item) => item.value === value);
    if (option) routes.push(option.route);
  }
  return worstRoute(routes);
}

/** The question the patient is expected to answer next, if any. */
export function expectedQuestionId(snapshot: Pick<FollowupSnapshot, "state" | "question_ids" | "answers">) {
  if (snapshot.state === "awaiting_reply") return OPENER_ID;
  if (snapshot.state !== "answering") return null;
  return snapshot.question_ids.find((id) => !(id in snapshot.answers)) ?? null;
}

export function openerMessage(protocol: Protocol, language: PatientLanguage, ctx: MessageContext): OutboundMessage {
  return {
    kind: "template",
    body: openerText(protocol, language, ctx),
    questionId: OPENER_ID,
    options: OPENER_VALUES.map((value) => ({ value, label: OPENER_LABELS[value][language] })),
  };
}

export function questionMessage(protocol: Protocol, questionId: string, language: PatientLanguage): OutboundMessage {
  const question = getQuestion(protocol, questionId);
  if (!question) throw new Error(`Unknown question ${questionId} in ${protocol.code}.`);
  return {
    kind: "question",
    body: question.text[language],
    questionId,
    options: question.options.map((option) => ({ value: option.value, label: option.label[language] })),
  };
}

function optionRoute(protocol: Protocol, questionId: string, value: string): Route | null {
  if (questionId === OPENER_ID) {
    return (OPENER_VALUES as readonly string[]).includes(value) ? protocol.openerRoutes[value as OpenerValue] : null;
  }
  return getQuestion(protocol, questionId)?.options.find((option) => option.value === value)?.route ?? null;
}

const REOPEN_FIELDS: FollowupPatch = { closed_at: null, closed_by: null, closure_reason: null, closure_note: null };

/** Applies one patient reply. Returns what to persist and send, or why it was ignored. */
export function applyReply(
  snapshot: FollowupSnapshot,
  protocol: Protocol,
  reply: InboundReply,
  ctx: MessageContext,
  now: Date = new Date()
): Outcome | Ignored {
  const lang = snapshot.language;

  if (reply.kind === "text") {
    const text = reply.text.trim();
    if (!text) return { ignored: "empty" };
    const events: LifecycleEvent[] = [{ type: "patient_message", note: text }];
    const outbound: OutboundMessage[] = [{ kind: "text", body: freeTextAck(lang) }];

    // Already with a doctor: keep the escalation, just record the message.
    if (snapshot.state === "escalated") return { patch: {}, outbound, events };

    if (snapshot.state === "closed") events.push({ type: "reopened", note: "Patient messaged after closure." });
    return {
      patch: {
        ...(snapshot.state === "closed" ? REOPEN_FIELDS : {}),
        state: "needs_call",
        call_reason: "patient_message",
        current_step_due_at: at(now, PATIENT_MESSAGE_DUE_HOURS * HOUR),
      },
      outbound,
      events,
    };
  }

  if (snapshot.state === "closed") return { ignored: "closed" };
  const expected = expectedQuestionId(snapshot);
  if (!expected || reply.questionId !== expected) return { ignored: "stale" };

  const route = optionRoute(protocol, reply.questionId, reply.value);
  if (!route) return { ignored: "unknown_option" };

  const answers = { ...snapshot.answers, [reply.questionId]: reply.value };
  const patch: FollowupPatch = { answers };
  if (snapshot.state === "awaiting_reply") patch.responded_at = at(now);
  const answered: LifecycleEvent = { type: "answered", data: { questionId: reply.questionId, value: reply.value, route } };

  if (route === "red") {
    return {
      patch: {
        ...patch,
        state: "escalated",
        route: "red",
        escalated_at: at(now),
        current_step_due_at: at(now, ESCALATION_DUE_MINUTES * MINUTE),
      },
      outbound: [{ kind: "text", body: redFlagText(lang, ctx.clinicName) }],
      events: [answered, { type: "red_flag", data: { questionId: reply.questionId, value: reply.value } }],
    };
  }

  const next = snapshot.question_ids.find((id) => !(id in answers));
  if (next) {
    const outbound: OutboundMessage[] = [];
    if (reply.questionId === OPENER_ID) outbound.push({ kind: "text", body: introText(lang) });
    outbound.push(questionMessage(protocol, next, lang));
    return {
      patch: { ...patch, state: "answering", current_step_due_at: at(now, NO_REPLY_HOURS * HOUR) },
      outbound,
      events: [answered],
    };
  }

  const overall = routeOfAnswers(protocol, answers) ?? "amber";
  if (overall === "green") {
    return {
      patch: {
        ...patch,
        state: "closed",
        route: "green",
        completed_at: at(now),
        current_step_due_at: null,
        closed_at: at(now),
        closed_by: null,
        closure_reason: "improved",
        closure_note: "Every answer was in the expected range.",
        call_reason: null,
      },
      outbound: [{ kind: "text", body: greenText(lang) }],
      events: [answered, { type: "completed", data: { route: "green" } }, { type: "closed", data: { reason: "improved" } }],
    };
  }

  return {
    patch: {
      ...patch,
      state: "needs_call",
      route: overall,
      completed_at: at(now),
      call_reason: "amber",
      current_step_due_at: at(now, CALL_DUE_HOURS * HOUR),
    },
    outbound: [{ kind: "text", body: amberText(lang, ctx.clinicName) }],
    events: [answered, { type: "completed", data: { route: overall } }],
  };
}

/**
 * Time-driven steps: sends the check-in when it falls due, and turns silence
 * into a nurse call. Returns null when nothing is due.
 */
export function applyTimers(
  snapshot: FollowupSnapshot,
  protocol: Protocol,
  ctx: MessageContext,
  now: Date = new Date()
): Outcome | null {
  if (!snapshot.current_step_due_at) return null;
  if (new Date(snapshot.current_step_due_at).getTime() > now.getTime()) return null;

  if (snapshot.state === "scheduled") {
    return {
      patch: { state: "awaiting_reply", sent_at: at(now), current_step_due_at: at(now, NO_REPLY_HOURS * HOUR) },
      outbound: [openerMessage(protocol, snapshot.language, ctx)],
      events: [{ type: "checkin_sent" }],
    };
  }

  if (snapshot.state === "awaiting_reply" || snapshot.state === "answering") {
    const reason: CallReason = snapshot.state === "awaiting_reply" ? "no_reply" : "incomplete";
    return {
      patch: { state: "needs_call", call_reason: reason, current_step_due_at: at(now, CALL_DUE_HOURS * HOUR) },
      outbound: [],
      events: [{ type: reason }],
    };
  }

  return null;
}

// ---- Staff decisions ----

export function canScheduleFollowups(role: StaffRole) {
  return role === "doctor";
}

export function canWorkFollowups(role: StaffRole) {
  return role === "doctor" || role === "nurse";
}

export function checkClosure(input: {
  role: StaffRole;
  state: FollowupState;
  route: Route | null;
  reason: ClosureReason;
  note: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.state === "closed") return { ok: false, error: "This follow-up is already closed." };
  if (!input.note.trim()) return { ok: false, error: "Add a note describing what was decided." };
  if (!canWorkFollowups(input.role)) return { ok: false, error: "Only clinical staff can close a follow-up." };

  if (input.reason === "cancelled" && input.state !== "scheduled") {
    return { ok: false, error: "Only a follow-up that hasn't been sent yet can be cancelled." };
  }

  const needsDoctor =
    input.state === "escalated" ||
    input.route === "red" ||
    input.reason === "unreachable" ||
    input.reason === "sent_to_emergency";
  if (needsDoctor && input.role !== "doctor") {
    return { ok: false, error: "A doctor must close a follow-up with red flags, or one closed without reaching the patient." };
  }

  return { ok: true };
}

// ---- Worklists ----

export const WORKLISTS = ["action", "waiting", "scheduled", "closed"] as const;
export type FollowupWorklist = (typeof WORKLISTS)[number];

export const WORKLIST_LABELS: Record<FollowupWorklist, string> = {
  action: "Needs action",
  waiting: "Waiting on patient",
  scheduled: "Scheduled",
  closed: "Closed",
};

export function worklistOf(state: FollowupState): FollowupWorklist {
  if (state === "needs_call" || state === "escalated") return "action";
  if (state === "awaiting_reply" || state === "answering") return "waiting";
  if (state === "scheduled") return "scheduled";
  return "closed";
}

/** Escalated first, then by due time. */
export function compareForAction(
  left: { state: FollowupState; current_step_due_at: string | null },
  right: { state: FollowupState; current_step_due_at: string | null }
) {
  if (left.state !== right.state) {
    if (left.state === "escalated") return -1;
    if (right.state === "escalated") return 1;
  }
  const leftDue = left.current_step_due_at ? new Date(left.current_step_due_at).getTime() : Infinity;
  const rightDue = right.current_step_due_at ? new Date(right.current_step_due_at).getTime() : Infinity;
  return leftDue - rightDue;
}

export function isOverdue(item: { state: FollowupState; current_step_due_at: string | null }, now = new Date()) {
  return (
    (item.state === "needs_call" || item.state === "escalated") &&
    !!item.current_step_due_at &&
    new Date(item.current_step_due_at).getTime() < now.getTime()
  );
}
