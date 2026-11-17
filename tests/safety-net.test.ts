import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuestionIds,
  CONFIDENCE_QUESTION,
  getProtocol,
  isRedFlagQuestion,
  PROTOCOLS,
  ROUTES,
  validSigns,
  type Protocol,
} from "../src/lib/safety-net/protocols.ts";
import {
  applyCallLog,
  applyReply,
  applyTimers,
  checkClosure,
  checkDecision,
  compareForAction,
  CONFIDENCE_ID,
  expectedQuestionId,
  initialDifferential,
  MAX_SEPARATING_QUESTIONS,
  nextQuestionId,
  OPENER_ID,
  riskRank,
  summarizeAnswers,
  worstRoute,
  type DifferentialEntry,
  type FollowupSnapshot,
  type Outcome,
} from "../src/lib/safety-net/workflow.ts";

const ctx = { clinicName: "Rimbun Demo Clinic", patientFirstName: "Aisyah", visitDate: "17 Nov 2026" };
const NOW = new Date("2026-11-19T02:00:00Z");

function protocol(code: string): Protocol {
  const found = getProtocol(code);
  assert.ok(found, `protocol ${code}`);
  return found;
}

function allSigns(code: string) {
  return protocol(code).signs.map((sign) => sign.id);
}

function allCauses(code: string) {
  const p = protocol(code);
  return initialDifferential(p, p.causes.map((cause) => ({ cause: cause.id, level: cause.defaultLevel })));
}

function snapshot(code: string, overrides: Partial<FollowupSnapshot> = {}): FollowupSnapshot {
  const p = protocol(code);
  return {
    state: "awaiting_reply",
    question_ids: buildQuestionIds(p, allSigns(code)),
    answers: {},
    language: "en",
    current_step_due_at: new Date(NOW.getTime() + 6 * 3600_000).toISOString(),
    closed_at: null,
    route: null,
    differential: [],
    pending_question_id: OPENER_ID,
    ...overrides,
  };
}

function asOutcome(result: ReturnType<typeof applyReply>): Outcome {
  assert.ok(!("ignored" in result), `expected an outcome, got ${JSON.stringify(result)}`);
  return result;
}

function apply(current: FollowupSnapshot, outcome: Outcome): FollowupSnapshot {
  return { ...current, ...outcome.patch } as FollowupSnapshot;
}

function greenValue(p: Protocol, questionId: string) {
  return p.questions.find((q) => q.id === questionId)!.options.find((o) => o.route === "green")!.value;
}

/**
 * Answers whatever question is live, the way a patient would, until the set is
 * done. `answers` overrides the default green answer; `opener` is the first tap.
 */
function converse(
  code: string,
  opener: string,
  answers: Record<string, string> = {},
  start: Partial<FollowupSnapshot> = {}
) {
  const p = protocol(code);
  let current = snapshot(code, start);
  const asked: string[] = [];
  const outcomes: Outcome[] = [];
  let questionId: string | null = OPENER_ID;
  let value = opener;
  for (let step = 0; step < 20 && questionId && questionId !== CONFIDENCE_ID; step++) {
    const outcome = asOutcome(applyReply(current, p, { kind: "button", questionId, value }, ctx, NOW));
    outcomes.push(outcome);
    current = apply(current, outcome);
    questionId = expectedQuestionId(current);
    if (questionId && questionId !== CONFIDENCE_ID) {
      asked.push(questionId);
      value = answers[questionId] ?? greenValue(p, questionId);
    }
  }
  return { current, outcomes, asked };
}

// ---- Question bank ----

test("every question set is well formed for WhatsApp buttons, both languages and cause effects", () => {
  const codes = new Set<string>();
  for (const p of [...PROTOCOLS]) {
    assert.ok(!codes.has(p.code), `duplicate code ${p.code}`);
    codes.add(p.code);
    const signIds = new Set(p.signs.map((sign) => sign.id));
    const causeIds = new Set(p.causes.map((cause) => cause.id));
    assert.equal(causeIds.size, p.causes.length, `${p.code}: duplicate cause`);
    const questionIds = new Set<string>();
    for (const q of [...p.questions, CONFIDENCE_QUESTION]) {
      if (q !== CONFIDENCE_QUESTION) {
        assert.ok(!questionIds.has(q.id), `${p.code}: duplicate question ${q.id}`);
        assert.ok(q.id !== OPENER_ID && q.id !== CONFIDENCE_ID, `${p.code}: reserved id ${q.id}`);
        questionIds.add(q.id);
      }
      if (q.sign) assert.ok(signIds.has(q.sign), `${p.code}/${q.id}: unknown sign ${q.sign}`);
      assert.ok(q.text.en.trim() && q.text.ms.trim(), `${p.code}/${q.id}: missing text`);
      assert.ok(q.options.length >= 2 && q.options.length <= 3, `${p.code}/${q.id}: 2 or 3 options`);
      assert.ok(q.options.some((o) => o.route === "green"), `${p.code}/${q.id}: needs a green option`);
      for (const option of q.options) {
        assert.ok(ROUTES.includes(option.route));
        for (const label of [option.label.en, option.label.ms]) {
          assert.ok(label.length > 0 && label.length <= 20, `${p.code}/${q.id}: "${label}" over 20 characters`);
        }
      }
      const values = new Set(q.options.map((o) => o.value));
      for (const [cause, effects] of Object.entries(q.tests ?? {})) {
        assert.ok(causeIds.has(cause), `${p.code}/${q.id}: tests unknown cause ${cause}`);
        for (const value of Object.keys(effects ?? {})) {
          assert.ok(values.has(value), `${p.code}/${q.id}: effect on unknown answer ${value}`);
        }
      }
      // A question that is neither a red flag nor tests a cause could never be asked.
      if (q !== CONFIDENCE_QUESTION && !isRedFlagQuestion(q)) {
        const effects = Object.values(q.tests ?? {}).reduce((sum, e) => sum + Object.keys(e ?? {}).length, 0);
        assert.ok(effects > 0, `${p.code}/${q.id}: not a red flag and moves no cause, so it would never be asked`);
      }
    }
  }
});

test("chosen warning signs add their questions; causes are kept to the protocol's list", () => {
  const p = protocol("adult_fever");
  assert.deepEqual(buildQuestionIds(p, []), ["fluids", "tummy", "fever_trend", "urine_pain"]);
  assert.deepEqual(buildQuestionIds(p, ["drowsy", "bleeding"]), [
    "fluids",
    "rash_bleeding",
    "drowsy",
    "tummy",
    "fever_trend",
    "urine_pain",
  ]);
  assert.deepEqual(validSigns(p, ["bleeding", "made_up", "bleeding"]), ["bleeding"]);
  assert.deepEqual(
    initialDifferential(p, [
      { cause: "dengue", level: "watch" },
      { cause: "made_up", level: "likely" },
      { cause: "uti", level: "raised" },
    ]),
    [
      { cause: "dengue", initial: "watch", level: "watch" },
      { cause: "uti", initial: "possible", level: "possible" },
    ]
  );
});

test("worst route wins", () => {
  assert.equal(worstRoute(["green", "amber", "green"]), "amber");
  assert.equal(worstRoute(["green", "red", null]), "red");
  assert.equal(worstRoute([]), null);
});

// ---- Question order ----

test("red-flag questions come first, then the question that separates the most open causes", () => {
  const p = protocol("adult_fever");
  const pool = buildQuestionIds(p, allSigns("adult_fever"));
  const differential = allCauses("adult_fever");
  const answers: Record<string, string> = { opener: "better" };
  const order: string[] = [];
  for (let id = nextQuestionId(p, pool, answers, differential); id; id = nextQuestionId(p, pool, answers, differential)) {
    order.push(id);
    answers[id] = greenValue(p, id);
  }
  assert.deepEqual(order.slice(0, 5), ["fluids", "rash_bleeding", "abdominal_pain", "urine", "drowsy"]);
  assert.deepEqual(order.slice(5).sort(), ["fever_trend", "tummy", "urine_pain"]);
});

test("a question that would change nothing is skipped", () => {
  const p = protocol("adult_fever");
  const pool = buildQuestionIds(p, []);
  const differential: DifferentialEntry[] = [
    { cause: "gastro", initial: "possible", level: "possible" },
    { cause: "uti", initial: "possible", level: "ruled_out" },
  ];
  const answers = { opener: "better", fluids: "yes" };
  assert.equal(nextQuestionId(p, pool, answers, differential), "tummy");
  assert.equal(nextQuestionId(p, pool, { ...answers, tummy: "ok" }, differential), null, "urine_pain can't change uti");
});

test("causes never touch safety: every chosen red-flag question is asked even when all causes are ruled out", () => {
  const p = protocol("adult_fever");
  const pool = buildQuestionIds(p, allSigns("adult_fever"));
  const ruledOut = allCauses("adult_fever").map((entry) => ({ ...entry, level: "ruled_out" as const }));
  const answers: Record<string, string> = { opener: "better" };
  const order: string[] = [];
  for (let id = nextQuestionId(p, pool, answers, ruledOut); id; id = nextQuestionId(p, pool, answers, ruledOut)) {
    order.push(id);
    answers[id] = greenValue(p, id);
  }
  assert.deepEqual(order, ["fluids", "rash_bleeding", "abdominal_pain", "urine", "drowsy"]);
});

test("with no causes chosen, every question in the pool is asked (the original behaviour)", () => {
  const { asked } = converse("adult_fever", "better", {}, { differential: [] });
  assert.equal(asked.length, buildQuestionIds(protocol("adult_fever"), allSigns("adult_fever")).length);
});

test("separating questions stop at the cap", () => {
  const many: Protocol = {
    ...protocol("adult_fever"),
    causes: [{ id: "x", label: "X", defaultLevel: "possible" }],
    questions: Array.from({ length: MAX_SEPARATING_QUESTIONS + 3 }, (_, i) => ({
      id: `q${i}`,
      text: { en: `Q${i}`, ms: `Q${i}` },
      options: [
        { value: "a", label: { en: "A", ms: "A" }, route: "green" as const },
        { value: "b", label: { en: "B", ms: "B" }, route: "green" as const },
      ],
      tests: { x: { b: "raises" as const } },
    })),
  };
  const pool = many.questions.map((q) => q.id);
  const differential: DifferentialEntry[] = [{ cause: "x", initial: "possible", level: "possible" }];
  const answers: Record<string, string> = {};
  let asked = 0;
  for (let id = nextQuestionId(many, pool, answers, differential); id; id = nextQuestionId(many, pool, answers, differential)) {
    answers[id] = "a";
    asked++;
  }
  assert.equal(asked, MAX_SEPARATING_QUESTIONS);
});

test("adult fever: 'tummy OK' rules out gastroenteritis; a rash raises dengue and the route", () => {
  const { current } = converse("adult_fever", "better", { tummy: "ok", rash_bleeding: "rash" }, { differential: allCauses("adult_fever") });
  const level = (cause: string) => current.differential.find((entry) => entry.cause === cause)?.level;
  assert.equal(level("gastro"), "ruled_out");
  assert.equal(level("dengue"), "raised");
  assert.equal(current.route, "amber");
  assert.equal(current.state, "needs_call");
  const dengue = current.differential.find((entry) => entry.cause === "dengue")!;
  assert.deepEqual([dengue.questionId, dengue.value], ["rash_bleeding", "rash"]);
});

// ---- Patient replies ----

test("all-green answers make the follow-up ready for a doctor to close, never closed on their own", () => {
  const { current, outcomes } = converse("adult_fever", "better", {}, { differential: allCauses("adult_fever") });
  assert.equal(current.state, "ready_to_close");
  assert.equal(current.route, "green");
  assert.equal(current.closed_at, null);
  assert.equal(expectedQuestionId(current), CONFIDENCE_ID, "asks 'Do you know what to do next?' last");
  assert.match(outcomes.at(-1)!.outbound[0].body, /improving[\s\S]*Do you know what to do next\?/);
});

test("'better' alone never closes: the questions still have to be answered, red flags first", () => {
  const p = protocol("adult_fever");
  const outcome = asOutcome(applyReply(snapshot("adult_fever"), p, { kind: "button", questionId: OPENER_ID, value: "better" }, ctx, NOW));
  const current = apply(snapshot("adult_fever"), outcome);
  assert.equal(current.state, "answering");
  assert.equal(expectedQuestionId(current), "fluids");
  assert.match(outcome.outbound[0].body, /A few quick questions[\s\S]*Can you drink/);
});

test("better but one amber answer goes to a nurse call", () => {
  const { current } = converse("adult_fever", "better", { fever_trend: "not_yet" });
  assert.equal(current.state, "needs_call");
  assert.equal(current.route, "amber");
});

test("'same' with all-green answers is still a nurse call", () => {
  assert.equal(converse("adult_fever", "same").current.state, "needs_call");
});

test("a red answer escalates at once, stops the questions and asks if they know what to do", () => {
  const { current, outcomes } = converse("adult_fever", "better", { fluids: "cannot" });
  assert.equal(current.state, "escalated");
  assert.equal(current.route, "red");
  const red = outcomes.at(-1)!;
  assert.ok(red.patch.escalated_at);
  assert.equal(red.outbound.length, 1);
  assert.match(red.outbound[0].body, /999[\s\S]*Do you know what to do next\?/);
  assert.equal(expectedQuestionId(current), CONFIDENCE_ID);
  assert.ok(red.events.some((event) => event.type === "red_flag"));
  assert.equal(Object.keys(current.answers).length, 2, "no questions after the red flag");
});

test("'worse' after a head injury escalates straight from the opener", () => {
  assert.equal(converse("head_injury", "worse").current.state, "escalated");
});

test("the closing question can only raise: 'not sure' brings a nurse, 'yes' changes nothing", () => {
  const p = protocol("adult_fever");
  const ready = converse("adult_fever", "better").current;
  const yes = apply(ready, asOutcome(applyReply(ready, p, { kind: "button", questionId: CONFIDENCE_ID, value: "yes" }, ctx, NOW)));
  assert.equal(yes.state, "ready_to_close");
  assert.equal(yes.route, "green");
  assert.equal(expectedQuestionId(yes), null);

  const unsure = apply(ready, asOutcome(applyReply(ready, p, { kind: "button", questionId: CONFIDENCE_ID, value: "not_sure" }, ctx, NOW)));
  assert.equal(unsure.state, "needs_call");
  assert.equal(unsure.route, "amber");

  const red = converse("adult_fever", "better", { fluids: "cannot" }).current;
  const redUnsure = apply(red, asOutcome(applyReply(red, p, { kind: "button", questionId: CONFIDENCE_ID, value: "no" }, ctx, NOW)));
  assert.equal(redUnsure.state, "escalated");
  assert.equal(redUnsure.route, "red");
});

test("only the live question can be answered; taps after closure change nothing", () => {
  const p = protocol("adult_fever");
  const answering = snapshot("adult_fever", { state: "answering", answers: { [OPENER_ID]: "better" }, pending_question_id: "fluids" });
  assert.deepEqual(applyReply(answering, p, { kind: "button", questionId: OPENER_ID, value: "worse" }, ctx, NOW), { ignored: "stale" });
  assert.deepEqual(applyReply(answering, p, { kind: "button", questionId: "tummy", value: "ok" }, ctx, NOW), { ignored: "stale" });
  assert.deepEqual(applyReply(answering, p, { kind: "button", questionId: "fluids", value: "maybe" }, ctx, NOW), {
    ignored: "unknown_option",
  });
  const closed = snapshot("adult_fever", { state: "closed", pending_question_id: CONFIDENCE_ID });
  assert.deepEqual(applyReply(closed, p, { kind: "button", questionId: CONFIDENCE_ID, value: "yes" }, ctx, NOW), {
    ignored: "closed",
  });
  assert.equal(expectedQuestionId(closed), null);
});

test("a typed message always reaches a person, and reopens a closed follow-up", () => {
  const p = protocol("child_fever");
  const mid = asOutcome(applyReply(snapshot("child_fever", { state: "answering" }), p, { kind: "text", text: "She is very sleepy" }, ctx, NOW));
  assert.equal(mid.patch.state, "needs_call");
  assert.equal(mid.patch.call_reason, "patient_message");
  assert.match(mid.outbound[0].body, /passed to the clinic team/);

  const ready = asOutcome(applyReply(snapshot("child_fever", { state: "ready_to_close" }), p, { kind: "text", text: "Worse tonight" }, ctx, NOW));
  assert.equal(ready.patch.state, "needs_call");

  const reopened = asOutcome(applyReply(snapshot("child_fever", { state: "closed" }), p, { kind: "text", text: "Worse again" }, ctx, NOW));
  assert.equal(reopened.patch.state, "needs_call");
  assert.equal(reopened.patch.closure_reason, null);
  assert.ok(reopened.events.some((event) => event.type === "reopened"));

  const escalated = asOutcome(applyReply(snapshot("child_fever", { state: "escalated" }), p, { kind: "text", text: "On our way" }, ctx, NOW));
  assert.equal(escalated.patch.state, undefined, "stays escalated");

  assert.deepEqual(applyReply(snapshot("child_fever"), p, { kind: "text", text: "   " }, ctx, NOW), { ignored: "empty" });
});

test("messages go out in the patient's language", () => {
  const p = protocol("adult_fever");
  const outcome = asOutcome(
    applyReply(snapshot("adult_fever", { language: "ms" }), p, { kind: "button", questionId: OPENER_ID, value: "same" }, ctx, NOW)
  );
  assert.match(outcome.outbound[0].body, /^Terima kasih[\s\S]*Bolehkah anda minum/);
});

test("route changes are timestamped so the list can highlight the row", () => {
  const p = protocol("adult_fever");
  const outcome = asOutcome(applyReply(snapshot("adult_fever"), p, { kind: "button", questionId: OPENER_ID, value: "same" }, ctx, NOW));
  assert.equal(outcome.patch.route, "amber");
  assert.equal(outcome.patch.route_changed_at, NOW.toISOString());
});

// ---- Timers ----

test("the check-in is sent when it falls due, not before", () => {
  const p = protocol("child_fever");
  const later = new Date(NOW.getTime() + 3600_000).toISOString();
  assert.equal(applyTimers(snapshot("child_fever", { state: "scheduled", current_step_due_at: later }), p, ctx, NOW), null);

  const due = applyTimers(snapshot("child_fever", { state: "scheduled", current_step_due_at: NOW.toISOString() }), p, ctx, NOW);
  assert.ok(due);
  assert.equal(due.patch.state, "awaiting_reply");
  assert.equal(due.patch.pending_question_id, OPENER_ID);
  assert.match(due.outbound[0].body, /checking on Aisyah/);
});

test("silence becomes a nurse call, and a late answer still counts", () => {
  const p = protocol("adult_fever");
  const past = new Date(NOW.getTime() - 1000).toISOString();
  const noReply = applyTimers(snapshot("adult_fever", { current_step_due_at: past }), p, ctx, NOW);
  assert.equal(noReply?.patch.state, "needs_call");
  assert.equal(noReply?.patch.call_reason, "no_reply");

  const partial = applyTimers(snapshot("adult_fever", { state: "answering", current_step_due_at: past }), p, ctx, NOW);
  assert.equal(partial?.patch.call_reason, "incomplete");
  assert.equal(applyTimers(snapshot("adult_fever", { state: "needs_call", current_step_due_at: past }), p, ctx, NOW), null);

  const waiting = { ...snapshot("adult_fever"), ...noReply!.patch } as FollowupSnapshot;
  const late = asOutcome(applyReply(waiting, p, { kind: "button", questionId: OPENER_ID, value: "better" }, ctx, NOW));
  assert.equal(late.patch.state, "answering");
});

// ---- Calls, decisions and closure ----

test("three unanswered calls hand the decision to a doctor", () => {
  assert.deepEqual(applyCallLog({ state: "needs_call", call_attempts: 0 }, "reached", "Spoke to her", NOW).patch, {});
  assert.equal(applyCallLog({ state: "needs_call", call_attempts: 0 }, "no_answer", null, NOW).patch.call_attempts, 1);
  assert.equal(applyCallLog({ state: "needs_call", call_attempts: 1 }, "no_answer", null, NOW).patch.state, undefined);
  const third = applyCallLog({ state: "needs_call", call_attempts: 2 }, "wrong_number", null, NOW);
  assert.equal(third.patch.state, "escalated");
  assert.ok(third.events.some((event) => event.type === "unreachable"));
  assert.equal(applyCallLog({ state: "escalated", call_attempts: 5 }, "no_answer", null, NOW).patch.state, undefined);
});

test("decisions: red follow-ups and sign-off are doctors' calls; a nurse can book a review on amber", () => {
  const amber = { state: "needs_call" as const, route: "amber" as const };
  assert.deepEqual(checkDecision({ ...amber, role: "nurse", decision: "book_review" }), { ok: true });
  assert.deepEqual(checkDecision({ ...amber, role: "nurse", decision: "message_patient" }), { ok: true });
  assert.equal(checkDecision({ ...amber, role: "nurse", decision: "order_test" }).ok, false);
  assert.equal(checkDecision({ state: "escalated", route: "red", role: "nurse", decision: "book_review" }).ok, false);
  assert.equal(checkDecision({ state: "escalated", route: "red", role: "doctor", decision: "order_test" }).ok, true);
  assert.equal(checkDecision({ ...amber, role: "doctor", decision: "approve_closure" }).ok, false);
  const ready = { state: "ready_to_close" as const, route: "green" as const };
  assert.equal(checkDecision({ ...ready, role: "doctor", decision: "approve_closure" }).ok, true);
  assert.equal(checkDecision({ ...ready, role: "nurse", decision: "approve_closure" }).ok, false);
  assert.equal(checkDecision({ state: "closed", route: "green", role: "doctor", decision: "keep_open" }).ok, false);
});

test("closure needs a note; red flags, sign-off and unreachable patients need a doctor", () => {
  const base = { state: "needs_call" as const, route: "amber" as const, note: "Spoke to patient, improving." };
  assert.deepEqual(checkClosure({ ...base, role: "nurse", reason: "review_booked" }), { ok: true });
  assert.equal(checkClosure({ ...base, role: "nurse", reason: "improved", note: " " }).ok, false);
  assert.equal(checkClosure({ ...base, role: "nurse", reason: "unreachable" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "doctor", reason: "unreachable" }).ok, true);
  assert.equal(checkClosure({ ...base, role: "nurse", state: "escalated", route: "red", reason: "review_booked" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "nurse", state: "ready_to_close", route: "green", reason: "improved" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "receptionist", reason: "improved" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "doctor", reason: "cancelled" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "doctor", state: "scheduled", reason: "cancelled" }).ok, true);
});

// ---- Staff list ----

test("the list ranks by risk, then due time", () => {
  const due = (hours: number) => new Date(NOW.getTime() + hours * 3600_000).toISOString();
  const rows = [
    { id: "none", state: "awaiting_reply" as const, route: null, current_step_due_at: due(1) },
    { id: "green", state: "ready_to_close" as const, route: "green" as const, current_step_due_at: due(1) },
    { id: "amber-late", state: "needs_call" as const, route: "amber" as const, current_step_due_at: due(5) },
    { id: "amber-soon", state: "needs_call" as const, route: "amber" as const, current_step_due_at: due(2) },
    { id: "red", state: "escalated" as const, route: "red" as const, current_step_due_at: due(9) },
    { id: "unreachable", state: "escalated" as const, route: null, current_step_due_at: due(3) },
  ];
  assert.deepEqual(
    [...rows].sort(compareForAction).map((row) => row.id),
    ["unreachable", "red", "amber-soon", "amber-late", "green", "none"]
  );
  assert.equal(riskRank({ state: "needs_call", route: null }), 3);
});

test("the answer summary comes from the question bank, most concerning first", () => {
  const p = protocol("adult_fever");
  assert.equal(summarizeAnswers(p, {}), null);
  assert.equal(
    summarizeAnswers(p, { opener: "better", tummy: "ok", rash_bleeding: "rash", fluids: "yes" }),
    "feeling better · new rash · tummy fine"
  );
  assert.equal(summarizeAnswers(p, { opener: "same", fever_trend: "not_yet" }, 2), "no change · fever not settling");
});
