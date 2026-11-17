import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuestionIds,
  getProtocol,
  PROTOCOLS,
  ROUTES,
  validSigns,
  type Protocol,
} from "../src/lib/safety-net/protocols.ts";
import {
  applyReply,
  applyTimers,
  checkClosure,
  expectedQuestionId,
  OPENER_ID,
  worstRoute,
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

function snapshot(code: string, overrides: Partial<FollowupSnapshot> = {}): FollowupSnapshot {
  const p = protocol(code);
  return {
    state: "awaiting_reply",
    question_ids: buildQuestionIds(p, p.signs.map((sign) => sign.id)),
    answers: {},
    language: "en",
    current_step_due_at: new Date(NOW.getTime() + 6 * 3600_000).toISOString(),
    closed_at: null,
    ...overrides,
  };
}

function asOutcome(result: ReturnType<typeof applyReply>): Outcome {
  assert.ok(!("ignored" in result), `expected an outcome, got ${JSON.stringify(result)}`);
  return result;
}

/** Plays a sequence of button taps, applying each patch, and returns the final snapshot. */
function play(code: string, taps: Array<[string, string]>, start: Partial<FollowupSnapshot> = {}) {
  const p = protocol(code);
  let current = snapshot(code, start);
  const outcomes: Outcome[] = [];
  for (const [questionId, value] of taps) {
    const outcome = asOutcome(applyReply(current, p, { kind: "button", questionId, value }, ctx, NOW));
    outcomes.push(outcome);
    current = { ...current, ...outcome.patch } as FollowupSnapshot;
  }
  return { current, outcomes };
}

/** The green option for every question in the set. */
function allGreen(code: string) {
  const p = protocol(code);
  return buildQuestionIds(p, p.signs.map((sign) => sign.id)).map((id) => {
    const option = p.questions.find((q) => q.id === id)!.options.find((o) => o.route === "green")!;
    return [id, option.value] as [string, string];
  });
}

// ---- Question sets ----

test("every question set is well formed for WhatsApp buttons in both languages", () => {
  const codes = new Set<string>();
  for (const p of PROTOCOLS) {
    assert.ok(!codes.has(p.code), `duplicate code ${p.code}`);
    codes.add(p.code);
    const signIds = new Set(p.signs.map((sign) => sign.id));
    const questionIds = new Set<string>();
    assert.ok(p.questions.some((q) => !q.sign), `${p.code} needs at least one always-asked question`);
    for (const q of p.questions) {
      assert.ok(!questionIds.has(q.id), `${p.code}: duplicate question ${q.id}`);
      assert.notEqual(q.id, OPENER_ID);
      questionIds.add(q.id);
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
    }
  }
});

test("chosen warning signs add their questions in protocol order", () => {
  const p = protocol("adult_fever");
  assert.deepEqual(buildQuestionIds(p, []), ["fever_now", "fluids"]);
  assert.deepEqual(buildQuestionIds(p, ["drowsy", "bleeding"]), ["fever_now", "fluids", "bleeding", "drowsy"]);
  assert.deepEqual(validSigns(p, ["bleeding", "made_up", "bleeding"]), ["bleeding"]);
});

test("worst route wins", () => {
  assert.equal(worstRoute(["green", "amber", "green"]), "amber");
  assert.equal(worstRoute(["green", "red", "amber"]), "red");
  assert.equal(worstRoute([]), null);
});

// ---- Patient replies ----

test("better with every answer green closes the follow-up as improved", () => {
  const { current, outcomes } = play("adult_fever", [[OPENER_ID, "better"], ...allGreen("adult_fever")]);
  assert.equal(current.state, "closed");
  const last = outcomes.at(-1)!;
  assert.equal(last.patch.closure_reason, "improved");
  assert.equal(last.patch.route, "green");
  assert.equal(last.patch.closed_by, null);
  assert.match(last.outbound[0].body, /improving/);
});

test("'better' alone never closes: the question set still has to be answered", () => {
  const { current, outcomes } = play("adult_fever", [[OPENER_ID, "better"]]);
  assert.equal(current.state, "answering");
  assert.equal(outcomes[0].outbound.length, 2, "intro plus first question");
  assert.equal(expectedQuestionId(current), "fever_now");
});

test("better but one amber answer goes to a nurse call", () => {
  const taps = allGreen("adult_fever").map(([id, value]) => (id === "fever_now" ? [id, "yes"] : [id, value])) as Array<
    [string, string]
  >;
  const { current, outcomes } = play("adult_fever", [[OPENER_ID, "better"], ...taps]);
  assert.equal(current.state, "needs_call");
  assert.equal(outcomes.at(-1)!.patch.call_reason, "amber");
  assert.equal(outcomes.at(-1)!.patch.route, "amber");
});

test("'same' with all-green answers is still a nurse call", () => {
  const { current } = play("adult_fever", [[OPENER_ID, "same"], ...allGreen("adult_fever")]);
  assert.equal(current.state, "needs_call");
});

test("a red answer escalates at once and stops the questions", () => {
  const { current, outcomes } = play("adult_fever", [
    [OPENER_ID, "better"],
    ["fever_now", "no"],
    ["fluids", "cannot"],
  ]);
  assert.equal(current.state, "escalated");
  const red = outcomes.at(-1)!;
  assert.equal(red.patch.route, "red");
  assert.ok(red.patch.escalated_at);
  assert.equal(red.outbound.length, 1);
  assert.match(red.outbound[0].body, /999/);
  assert.equal(expectedQuestionId(current), null, "no further questions after a red flag");
  assert.ok(red.events.some((event) => event.type === "red_flag"));
});

test("'worse' after a head injury escalates straight from the opener", () => {
  const { current } = play("head_injury", [[OPENER_ID, "worse"]]);
  assert.equal(current.state, "escalated");
});

test("taps on an old question or after closure change nothing", () => {
  const p = protocol("adult_fever");
  const answering = snapshot("adult_fever", { state: "answering", answers: { [OPENER_ID]: "better" } });
  assert.deepEqual(applyReply(answering, p, { kind: "button", questionId: OPENER_ID, value: "worse" }, ctx, NOW), {
    ignored: "stale",
  });
  assert.deepEqual(applyReply(answering, p, { kind: "button", questionId: "fluids", value: "yes" }, ctx, NOW), {
    ignored: "stale",
  });
  const closed = snapshot("adult_fever", { state: "closed" });
  assert.deepEqual(applyReply(closed, p, { kind: "button", questionId: OPENER_ID, value: "better" }, ctx, NOW), {
    ignored: "closed",
  });
  assert.deepEqual(applyReply(answering, p, { kind: "button", questionId: "fever_now", value: "maybe" }, ctx, NOW), {
    ignored: "unknown_option",
  });
});

test("a typed message always reaches a person, and reopens a closed follow-up", () => {
  const p = protocol("child_fever");
  const mid = asOutcome(
    applyReply(snapshot("child_fever", { state: "answering" }), p, { kind: "text", text: "She is very sleepy" }, ctx, NOW)
  );
  assert.equal(mid.patch.state, "needs_call");
  assert.equal(mid.patch.call_reason, "patient_message");
  assert.match(mid.outbound[0].body, /passed to the clinic team/);

  const reopened = asOutcome(
    applyReply(snapshot("child_fever", { state: "closed" }), p, { kind: "text", text: "Worse again" }, ctx, NOW)
  );
  assert.equal(reopened.patch.state, "needs_call");
  assert.equal(reopened.patch.closure_reason, null);
  assert.ok(reopened.events.some((event) => event.type === "reopened"));

  const escalated = asOutcome(
    applyReply(snapshot("child_fever", { state: "escalated" }), p, { kind: "text", text: "On our way" }, ctx, NOW)
  );
  assert.equal(escalated.patch.state, undefined, "stays escalated");

  assert.deepEqual(applyReply(snapshot("child_fever"), p, { kind: "text", text: "   " }, ctx, NOW), { ignored: "empty" });
});

test("messages go out in the patient's language", () => {
  const p = protocol("adult_fever");
  const outcome = asOutcome(
    applyReply(snapshot("adult_fever", { language: "ms" }), p, { kind: "button", questionId: OPENER_ID, value: "same" }, ctx, NOW)
  );
  assert.match(outcome.outbound[0].body, /Terima kasih/);
  assert.equal(outcome.outbound[1].body, "Adakah anda masih demam?");
});

// ---- Timers ----

test("the check-in is sent when it falls due, not before", () => {
  const p = protocol("child_fever");
  const later = new Date(NOW.getTime() + 3600_000).toISOString();
  assert.equal(applyTimers(snapshot("child_fever", { state: "scheduled", current_step_due_at: later }), p, ctx, NOW), null);

  const due = applyTimers(snapshot("child_fever", { state: "scheduled", current_step_due_at: NOW.toISOString() }), p, ctx, NOW);
  assert.ok(due);
  assert.equal(due.patch.state, "awaiting_reply");
  assert.equal(due.outbound[0].kind, "template");
  assert.match(due.outbound[0].body, /checking on Aisyah/);
  assert.deepEqual(
    due.outbound[0].kind === "template" ? due.outbound[0].options.map((o) => o.value) : [],
    ["better", "same", "worse"]
  );
});

test("silence becomes a nurse call: no reply, or an unfinished set", () => {
  const p = protocol("adult_fever");
  const past = new Date(NOW.getTime() - 1000).toISOString();
  const noReply = applyTimers(snapshot("adult_fever", { current_step_due_at: past }), p, ctx, NOW);
  assert.equal(noReply?.patch.state, "needs_call");
  assert.equal(noReply?.patch.call_reason, "no_reply");

  const partial = applyTimers(snapshot("adult_fever", { state: "answering", current_step_due_at: past }), p, ctx, NOW);
  assert.equal(partial?.patch.call_reason, "incomplete");

  assert.equal(applyTimers(snapshot("adult_fever", { state: "needs_call", current_step_due_at: past }), p, ctx, NOW), null);
});

// ---- Closure ----

test("closure needs a note, and red flags or unreachable patients need a doctor", () => {
  const base = { state: "needs_call" as const, route: "amber" as const, note: "Spoke to patient, improving." };
  assert.deepEqual(checkClosure({ ...base, role: "nurse", reason: "improved" }), { ok: true });
  assert.equal(checkClosure({ ...base, role: "nurse", reason: "improved", note: " " }).ok, false);
  assert.equal(checkClosure({ ...base, role: "nurse", reason: "unreachable" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "doctor", reason: "unreachable" }).ok, true);
  assert.equal(checkClosure({ ...base, role: "nurse", state: "escalated", route: "red", reason: "review_booked" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "receptionist", reason: "improved" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "doctor", reason: "cancelled" }).ok, false);
  assert.equal(checkClosure({ ...base, role: "doctor", state: "scheduled", reason: "cancelled" }).ok, true);
});
