import type { PatientLanguage } from "../care-loop/catalogue.ts";
import type { StaffRole } from "@/types/database";
import {
  amberText,
  confidenceAck,
  freeTextAck,
  greenText,
  introText,
  openerText,
  redFlagText,
  type MessageContext,
} from "./messages.ts";
import {
  CONFIDENCE_QUESTION,
  getQuestion,
  isRedFlagQuestion,
  OPENER_LABELS,
  OPENER_NOTES,
  OPENER_VALUES,
  STARTING_LEVELS,
  type CauseLevel,
  type OpenerValue,
  type Protocol,
  type Question,
  type Route,
  type StartingLevel,
} from "./protocols.ts";

// The safety-net follow-up lifecycle, as pure functions so every rule can be
// tested without a database. The server layer persists what these return.
//
// Rules that matter for safety:
// - Red-flag questions (any answer routing red) are always asked, first. The
//   possible causes only decide which other questions to ask; they never skip a
//   red-flag question and never lower the route.
// - A red answer escalates at once: emergency advice, a doctor alert, no more
//   questions.
// - The worst answer decides the route. All-green answers never close a
//   follow-up on their own: they make it "Ready to close" for a doctor to sign off.
// - Silence is not "fine": no reply, or an unfinished set, becomes a nurse call.
// - Any typed message reaches a person, even after the follow-up has closed.
// - Only the question that is currently live can be answered; taps on older
//   questions, or after closure, change nothing.

export const FOLLOWUP_STATES = [
  "scheduled",
  "awaiting_reply",
  "answering",
  "needs_call",
  "escalated",
  "ready_to_close",
  "closed",
] as const;
export type FollowupState = (typeof FOLLOWUP_STATES)[number];

export const STATE_LABELS: Record<FollowupState, string> = {
  scheduled: "Scheduled",
  awaiting_reply: "Waiting for reply",
  answering: "Patient answering",
  needs_call: "Nurse to call",
  escalated: "Doctor alerted",
  ready_to_close: "Ready to close",
  closed: "Closed",
};

export const CALL_REASONS = ["amber", "no_reply", "incomplete", "patient_message", "unsure", "kept_open"] as const;
export type CallReason = (typeof CALL_REASONS)[number];

export const CALL_REASON_LABELS: Record<CallReason, string> = {
  amber: "Answers need a check",
  no_reply: "No reply",
  incomplete: "Stopped part-way",
  patient_message: "Patient sent a message",
  unsure: "Unsure of next step",
  kept_open: "Doctor kept it open",
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
  improved: "Minor illness, resolved (patient-reported)",
  review_booked: "Physical review booked",
  blood_test: "Sent for test",
  sent_to_emergency: "Sent to emergency",
  unreachable: "Unreachable",
  cancelled: "Cancelled before check-in",
};

export const OPENER_ID = "opener";
export const CONFIDENCE_ID = CONFIDENCE_QUESTION.id;

/** Hours a patient has to reply before a nurse is asked to call. */
export const NO_REPLY_HOURS = 6;
export const CALL_DUE_HOURS = 2;
export const PATIENT_MESSAGE_DUE_HOURS = 1;
export const ESCALATION_DUE_MINUTES = 15;
export const SIGN_OFF_DUE_HOURS = 24;
export const UNREACHABLE_AFTER_CALLS = 3;
/** Questions asked to tell causes apart, after the red-flag questions. */
export const MAX_SEPARATING_QUESTIONS = 5;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const ROUTE_RANK: Record<Route, number> = { green: 0, amber: 1, red: 2 };

export function worstRoute(routes: Array<Route | null | undefined>): Route | null {
  const present = routes.filter((route): route is Route => !!route);
  if (present.length === 0) return null;
  return present.reduce((worst, route) => (ROUTE_RANK[route] > ROUTE_RANK[worst] ? route : worst));
}

// ---- Possible causes ----

/** One possible cause, where it started, where it is now, and the answer that moved it. */
export type DifferentialEntry = {
  cause: string;
  initial: StartingLevel;
  level: CauseLevel;
  questionId?: string;
  value?: string;
};

/** The doctor's chosen causes, kept to the protocol's list and valid starting levels. */
export function initialDifferential(protocol: Protocol, chosen: Array<{ cause: string; level: string }>): DifferentialEntry[] {
  const seen = new Set<string>();
  const entries: DifferentialEntry[] = [];
  for (const cause of protocol.causes) {
    const pick = chosen.find((item) => item.cause === cause.id);
    if (!pick || seen.has(cause.id)) continue;
    seen.add(cause.id);
    const level = (STARTING_LEVELS as string[]).includes(pick.level) ? (pick.level as StartingLevel) : cause.defaultLevel;
    entries.push({ cause: cause.id, initial: level, level });
  }
  return entries;
}

function isOpenCause(level: CauseLevel) {
  return level === "likely" || level === "watch" || level === "possible";
}

/**
 * Records what an answer did to each cause it tests. A raised cause stays
 * raised. Each cause keeps the answer that moved it; an answer that changed
 * nothing is only recorded when no earlier answer tested that cause.
 */
export function applyEffects(differential: DifferentialEntry[], question: Question, value: string): DifferentialEntry[] {
  if (!question.tests) return differential;
  return differential.map((entry) => {
    const test = question.tests?.[entry.cause];
    if (!test) return entry;
    const effect = test[value];
    let level = entry.level;
    if (effect === "raises") level = "raised";
    else if (effect === "rules_out" && entry.level !== "raised") level = "ruled_out";
    if (level === entry.level && entry.questionId) return entry;
    return { ...entry, level, questionId: question.id, value };
  });
}

/** How many still-open causes this question could move, whichever way the patient answers. */
export function separationScore(question: Question, differential: DifferentialEntry[]) {
  if (!question.tests) return 0;
  return differential.filter((entry) => {
    const test = question.tests?.[entry.cause];
    return isOpenCause(entry.level) && !!test && Object.keys(test).length > 0;
  }).length;
}

/**
 * The next question to ask, or null when the set is done:
 * 1. any unanswered red-flag question, in protocol order;
 * 2. with no causes chosen, the remaining questions in protocol order (the original behaviour);
 * 3. otherwise the question that could move the most open causes, up to a cap,
 *    skipping questions that would change nothing.
 */
export function nextQuestionId(
  protocol: Protocol,
  pool: string[],
  answers: Record<string, string>,
  differential: DifferentialEntry[]
): string | null {
  const open = pool
    .filter((id) => id !== OPENER_ID && id !== CONFIDENCE_ID && !(id in answers))
    .map((id) => getQuestion(protocol, id))
    .filter((question): question is Question => !!question);

  const redFlag = open.find(isRedFlagQuestion);
  if (redFlag) return redFlag.id;

  if (differential.length === 0) return open[0]?.id ?? null;

  const separatingAsked = Object.keys(answers).filter((id) => {
    if (id === OPENER_ID || id === CONFIDENCE_ID) return false;
    const question = getQuestion(protocol, id);
    return !!question && !isRedFlagQuestion(question);
  }).length;
  if (separatingAsked >= MAX_SEPARATING_QUESTIONS) return null;

  let best: Question | null = null;
  let bestScore = 0;
  for (const question of open) {
    const score = separationScore(question, differential);
    if (score > bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best?.id ?? null;
}

// ---- Snapshots and outcomes ----

/** The follow-up fields the lifecycle reads. */
export type FollowupSnapshot = {
  state: FollowupState;
  question_ids: string[];
  answers: Record<string, string>;
  language: PatientLanguage;
  current_step_due_at: string | null;
  closed_at: string | null;
  route: Route | null;
  call_reason: CallReason | null;
  differential: DifferentialEntry[];
  /** The one question the patient can answer now (null when none is live). */
  pending_question_id: string | null;
};

/** The follow-up fields the lifecycle may write. */
export type FollowupPatch = Partial<{
  state: FollowupState;
  answers: Record<string, string>;
  differential: DifferentialEntry[];
  pending_question_id: string | null;
  route: Route | null;
  route_changed_at: string;
  current_step_due_at: string | null;
  sent_at: string;
  responded_at: string;
  completed_at: string;
  escalated_at: string;
  call_attempts: number;
  call_reason: CallReason | null;
  review_at: string | null;
  ordered_test_code: string | null;
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

function optionRoute(protocol: Protocol, questionId: string, value: string): Route | null {
  if (questionId === OPENER_ID) {
    return (OPENER_VALUES as readonly string[]).includes(value) ? protocol.openerRoutes[value as OpenerValue] : null;
  }
  return getQuestion(protocol, questionId)?.options.find((option) => option.value === value)?.route ?? null;
}

/** All answer routes so far, opener and closing question included. */
export function routeOfAnswers(protocol: Protocol, answers: Record<string, string>): Route | null {
  return worstRoute(Object.entries(answers).map(([questionId, value]) => optionRoute(protocol, questionId, value)));
}

/** The question the patient can answer now. One source of truth for the engine and the phone. */
export function expectedQuestionId(snapshot: Pick<FollowupSnapshot, "state" | "pending_question_id">) {
  return snapshot.state === "closed" ? null : snapshot.pending_question_id;
}

export function openerMessage(protocol: Protocol, language: PatientLanguage, ctx: MessageContext): OutboundMessage {
  return {
    kind: "template",
    body: openerText(protocol, language, ctx),
    questionId: OPENER_ID,
    options: OPENER_VALUES.map((value) => ({ value, label: OPENER_LABELS[value][language] })),
  };
}

export function questionMessage(protocol: Protocol, questionId: string, language: PatientLanguage, lead?: string): OutboundMessage {
  const question = getQuestion(protocol, questionId);
  if (!question) throw new Error(`Unknown question ${questionId} in ${protocol.code}.`);
  return {
    kind: "question",
    body: lead ? `${lead}\n\n${question.text[language]}` : question.text[language],
    questionId,
    options: question.options.map((option) => ({ value: option.value, label: option.label[language] })),
  };
}

const REOPEN_FIELDS: FollowupPatch = { closed_at: null, closed_by: null, closure_reason: null, closure_note: null };

/** Adds the route-change timestamp when the route moved, so the list can highlight the row. */
function withRouteChange(snapshot: FollowupSnapshot, outcome: Outcome, now: Date): Outcome {
  if (outcome.patch.route !== undefined && outcome.patch.route !== snapshot.route) {
    return { ...outcome, patch: { ...outcome.patch, route_changed_at: at(now) } };
  }
  return outcome;
}

/**
 * A patient's late answers are recorded and can raise the route, but never
 * take a follow-up away from a person who has to act: an escalated follow-up
 * stays with the doctor (unless it becomes more urgent, which it already is),
 * and a nurse call for a typed message stays until someone reads it.
 */
function keepWithPerson(snapshot: FollowupSnapshot, outcome: Outcome): Outcome {
  const next = outcome.patch.state;
  if (!next) return outcome;
  const holdForDoctor = snapshot.state === "escalated" && next !== "escalated";
  const holdForMessage =
    snapshot.state === "needs_call" &&
    snapshot.call_reason === "patient_message" &&
    next !== "escalated";
  if (!holdForDoctor && !holdForMessage) return outcome;
  const { state: _state, call_reason: _reason, current_step_due_at: _due, ...rest } = outcome.patch;
  void _state;
  void _reason;
  void _due;
  return { ...outcome, patch: rest };
}

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
  const question = reply.questionId === OPENER_ID ? null : getQuestion(protocol, reply.questionId);
  const differential = question ? applyEffects(snapshot.differential ?? [], question, reply.value) : snapshot.differential ?? [];
  const base: FollowupPatch = { answers, differential, pending_question_id: null };
  if (snapshot.state === "awaiting_reply") base.responded_at = at(now);
  const answered: LifecycleEvent = { type: "answered", data: { questionId: reply.questionId, value: reply.value, route } };

  // The closing "Do you know what to do next?" question. It can only raise.
  if (reply.questionId === CONFIDENCE_ID) {
    if (route === "green") {
      return { patch: base, outbound: [{ kind: "text", body: confidenceAck(lang, "understood") }], events: [answered] };
    }
    if (snapshot.state === "escalated") {
      return {
        patch: base,
        outbound: [{ kind: "text", body: redFlagText(lang, ctx.clinicName) }],
        events: [answered, { type: "unsure_next_step" }],
      };
    }
    const toCall: FollowupPatch =
      snapshot.state === "needs_call"
        ? {}
        : { state: "needs_call", call_reason: "unsure", current_step_due_at: at(now, CALL_DUE_HOURS * HOUR) };
    return withRouteChange(
      snapshot,
      {
        patch: { ...base, ...toCall, route: worstRoute([snapshot.route, "amber"]) },
        outbound: [{ kind: "text", body: confidenceAck(lang, "unsure") }],
        events: [answered, { type: "unsure_next_step" }],
      },
      now
    );
  }

  return keepWithPerson(snapshot, answerOutcome(snapshot, protocol, reply, ctx, now, { answers, differential, base, answered, route }));
}

function answerOutcome(
  snapshot: FollowupSnapshot,
  protocol: Protocol,
  reply: { questionId: string; value: string },
  ctx: MessageContext,
  now: Date,
  given: {
    answers: Record<string, string>;
    differential: DifferentialEntry[];
    base: FollowupPatch;
    answered: LifecycleEvent;
    route: Route;
  }
): Outcome {
  const lang = snapshot.language;
  const { answers, differential, base, answered, route } = given;

  if (route === "red") {
    return withRouteChange(
      snapshot,
      {
        patch: {
          ...base,
          state: "escalated",
          route: "red",
          escalated_at: at(now),
          current_step_due_at: at(now, ESCALATION_DUE_MINUTES * MINUTE),
          pending_question_id: CONFIDENCE_ID,
        },
        outbound: [questionMessage(protocol, CONFIDENCE_ID, lang, redFlagText(lang, ctx.clinicName))],
        events: [answered, { type: "red_flag", data: { questionId: reply.questionId, value: reply.value } }],
      },
      now
    );
  }

  const next = nextQuestionId(protocol, snapshot.question_ids, answers, differential);
  if (next) {
    return withRouteChange(
      snapshot,
      {
        patch: {
          ...base,
          state: "answering",
          route: routeOfAnswers(protocol, answers),
          pending_question_id: next,
          current_step_due_at: at(now, NO_REPLY_HOURS * HOUR),
        },
        outbound: [questionMessage(protocol, next, lang, reply.questionId === OPENER_ID ? introText(lang) : undefined)],
        events: [answered],
      },
      now
    );
  }

  const skipped = snapshot.question_ids.filter((id) => !(id in answers));
  const overall = routeOfAnswers(protocol, answers) ?? "amber";
  const completed: LifecycleEvent = { type: "completed", data: { route: overall, skipped } };

  if (overall === "green") {
    return withRouteChange(
      snapshot,
      {
        patch: {
          ...base,
          state: "ready_to_close",
          route: "green",
          completed_at: at(now),
          call_reason: null,
          pending_question_id: CONFIDENCE_ID,
          current_step_due_at: at(now, SIGN_OFF_DUE_HOURS * HOUR),
        },
        outbound: [questionMessage(protocol, CONFIDENCE_ID, lang, greenText(lang))],
        events: [answered, completed],
      },
      now
    );
  }

  return withRouteChange(
    snapshot,
    {
      patch: {
        ...base,
        state: "needs_call",
        route: overall,
        completed_at: at(now),
        call_reason: "amber",
        pending_question_id: CONFIDENCE_ID,
        current_step_due_at: at(now, CALL_DUE_HOURS * HOUR),
      },
      outbound: [questionMessage(protocol, CONFIDENCE_ID, lang, amberText(lang, ctx.clinicName))],
      events: [answered, completed],
    },
    now
  );
}

/**
 * Time-driven steps: sends the check-in when it falls due, and turns silence
 * into a nurse call. The live question stays open, so a late answer still counts.
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
      patch: {
        state: "awaiting_reply",
        sent_at: at(now),
        pending_question_id: OPENER_ID,
        current_step_due_at: at(now, NO_REPLY_HOURS * HOUR),
      },
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

/**
 * Logging a call. After UNREACHABLE_AFTER_CALLS unanswered calls a nurse is
 * waiting on, a doctor has to decide what happens next.
 */
export function applyCallLog(
  snapshot: Pick<FollowupSnapshot, "state"> & { call_attempts: number },
  outcome: "reached" | "no_answer" | "wrong_number",
  note: string | null,
  now: Date = new Date()
): Outcome {
  const logged: LifecycleEvent = { type: "call_logged", note, data: { outcome } };
  if (outcome === "reached") return { patch: {}, outbound: [], events: [logged] };

  const attempts = snapshot.call_attempts + 1;
  if (snapshot.state === "needs_call" && attempts >= UNREACHABLE_AFTER_CALLS) {
    return {
      patch: {
        call_attempts: attempts,
        state: "escalated",
        escalated_at: at(now),
        current_step_due_at: at(now, ESCALATION_DUE_MINUTES * MINUTE),
      },
      outbound: [],
      events: [logged, { type: "unreachable", data: { attempts } }],
    };
  }
  return { patch: { call_attempts: attempts }, outbound: [], events: [logged] };
}

// ---- Staff decisions ----

export function canScheduleFollowups(role: StaffRole) {
  return role === "doctor";
}

export function canWorkFollowups(role: StaffRole) {
  return role === "doctor" || role === "nurse";
}

export const DECISIONS = [
  "book_review",
  "order_test",
  "message_patient",
  "close_minor",
  "approve_closure",
  "keep_open",
] as const;
export type Decision = (typeof DECISIONS)[number];

const DOCTOR_ONLY: Decision[] = ["order_test", "close_minor", "approve_closure", "keep_open"];

export function isHighRisk(item: { state: FollowupState; route: Route | null }) {
  return item.state === "escalated" || item.route === "red";
}

/** Who may take each decision. On a red follow-up every decision is a doctor's. */
export function checkDecision(input: {
  role: StaffRole;
  state: FollowupState;
  route: Route | null;
  decision: Decision;
}): { ok: true } | { ok: false; error: string } {
  if (input.state === "closed") return { ok: false, error: "This follow-up is closed." };
  if (!canWorkFollowups(input.role)) return { ok: false, error: "Only clinical staff can act on a follow-up." };
  if ((DOCTOR_ONLY.includes(input.decision) || isHighRisk(input)) && input.role !== "doctor") {
    return { ok: false, error: "A doctor must make this decision." };
  }
  if ((input.decision === "approve_closure" || input.decision === "keep_open") && input.state !== "ready_to_close") {
    return { ok: false, error: "Only a follow-up that is ready to close can be signed off." };
  }
  if (input.decision === "book_review" || input.decision === "order_test" || input.decision === "close_minor") {
    if (input.state === "scheduled") return { ok: false, error: "The check-in hasn't been sent yet. Cancel it instead." };
  }
  return { ok: true };
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
    isHighRisk(input) ||
    input.state === "ready_to_close" ||
    input.reason === "improved" ||
    input.reason === "unreachable" ||
    input.reason === "sent_to_emergency";
  if (needsDoctor && input.role !== "doctor") {
    return {
      ok: false,
      error: "A doctor must close this: red flags, minor-illness sign-off, emergency referral or an unreachable patient.",
    };
  }

  return { ok: true };
}

// ---- Worklists and ranking ----

export const WORKLISTS = ["action", "waiting", "scheduled", "closed"] as const;
export type FollowupWorklist = (typeof WORKLISTS)[number];

export const WORKLIST_LABELS: Record<FollowupWorklist, string> = {
  action: "Needs action",
  waiting: "Waiting on patient",
  scheduled: "Scheduled",
  closed: "Closed",
};

export function worklistOf(state: FollowupState): FollowupWorklist {
  if (state === "needs_call" || state === "escalated" || state === "ready_to_close") return "action";
  if (state === "awaiting_reply" || state === "answering") return "waiting";
  if (state === "scheduled") return "scheduled";
  return "closed";
}

export const RISK_LABELS: Record<Route, string> = { red: "High risk", amber: "Medium risk", green: "Low risk" };

/** 0 = high risk (red or with a doctor), 1 = medium, 2 = low, 3 = no answer yet. */
export function riskRank(item: { state: FollowupState; route: Route | null }) {
  if (isHighRisk(item)) return 0;
  if (item.route === "amber") return 1;
  if (item.route === "green") return 2;
  return 3;
}

/** Highest risk first, then the earliest due. */
export function compareForAction(
  left: { state: FollowupState; route: Route | null; current_step_due_at: string | null },
  right: { state: FollowupState; route: Route | null; current_step_due_at: string | null }
) {
  const rank = riskRank(left) - riskRank(right);
  if (rank !== 0) return rank;
  const leftDue = left.current_step_due_at ? new Date(left.current_step_due_at).getTime() : Infinity;
  const rightDue = right.current_step_due_at ? new Date(right.current_step_due_at).getTime() : Infinity;
  return leftDue - rightDue;
}

export function isOverdue(item: { state: FollowupState; current_step_due_at: string | null }, now = new Date()) {
  return (
    (item.state === "needs_call" || item.state === "escalated" || item.state === "ready_to_close") &&
    !!item.current_step_due_at &&
    new Date(item.current_step_due_at).getTime() < now.getTime()
  );
}

/**
 * A one-line summary of the answers for the staff list, built from the
 * question bank's own notes (never written by a model): the opener, then the
 * most concerning answers.
 */
export function summarizeAnswers(protocol: Protocol, answers: Record<string, string>, limit = 3): string | null {
  const parts: string[] = [];
  const opener = answers[OPENER_ID];
  if (opener && (OPENER_VALUES as readonly string[]).includes(opener)) parts.push(OPENER_NOTES[opener as OpenerValue]);

  const notes = Object.entries(answers)
    .filter(([id]) => id !== OPENER_ID && id !== CONFIDENCE_ID)
    .map(([id, value]) => getQuestion(protocol, id)?.options.find((option) => option.value === value))
    .filter((option): option is NonNullable<typeof option> => !!option?.note)
    .sort((left, right) => ROUTE_RANK[right.route] - ROUTE_RANK[left.route])
    .map((option) => option.note!);
  parts.push(...notes);

  if (parts.length === 0) return null;
  return parts.slice(0, limit).join(" · ");
}
