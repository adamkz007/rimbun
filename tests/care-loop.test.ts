import test from "node:test";
import assert from "node:assert/strict";
import {
  formatResultValue,
  parseBloodPressure,
  suggestUrgency,
  TEST_CATALOGUE,
} from "../src/lib/care-loop/catalogue.ts";
import {
  buildPatientMessage,
  buildWhatsAppLink,
  normalizePhone,
  parseDateOfBirthInput,
  patientTracker,
  teachBackOptions,
  verifyPatientIdentity,
} from "../src/lib/care-loop/messages.ts";
import { clinicDateStart, clinicToday, formatClinicDate, formatClinicDateTime } from "../src/lib/care-loop/format.ts";
import { computeLoopMetrics, median, type MetricsCase } from "../src/lib/care-loop/metrics.ts";
import { buildReferralLetter } from "../src/lib/care-loop/referral-letter.ts";
import { generateLinkToken, hashLinkToken, isLinkExpired, isWellFormedToken } from "../src/lib/care-loop/tokens.ts";
import {
  canAdvanceTo,
  checkClosure,
  computeDueAt,
  escalationTier,
  matchesWorklist,
  needsDoctorDecision,
  nextReminderDue,
} from "../src/lib/care-loop/workflow.ts";
import { isModuleImplemented, isModuleVisibleInNav } from "../src/lib/modules.ts";

// ---- Catalogue rules ----

test("catalogue covers routine checks, fever triage, older adults and cancer screening", () => {
  const categories = new Set(TEST_CATALOGUE.map((item) => item.category));
  for (const category of ["routine", "fever", "older_adult", "cancer", "infection"]) {
    assert.ok(categories.has(category as never), `missing ${category}`);
  }
  const codes = TEST_CATALOGUE.map((item) => item.code);
  assert.equal(new Set(codes).size, codes.length, "test codes are unique");
  for (const item of TEST_CATALOGUE) {
    assert.ok(item.about.en && item.about.ms && item.meaning.en && item.meaning.ms, `${item.code} copy`);
  }
});

test("numeric bands flag HbA1c by the clinic defaults", () => {
  assert.equal(suggestUrgency("hba1c", { numeric: 5.4 }), null);
  assert.equal(suggestUrgency("hba1c", { numeric: 5.9 }), "routine");
  assert.equal(suggestUrgency("hba1c", { numeric: 7.8 }), "soon");
  assert.equal(suggestUrgency("hba1c", { numeric: 11.2 }), "urgent");
});

test("low and high bands both flag, e.g. potassium and fasting glucose", () => {
  assert.equal(suggestUrgency("potassium", { numeric: 6.4 }), "critical");
  assert.equal(suggestUrgency("potassium", { numeric: 5.7 }), "urgent");
  assert.equal(suggestUrgency("potassium", { numeric: 4.2 }), null);
  assert.equal(suggestUrgency("potassium", { numeric: 3.2 }), "soon");
  assert.equal(suggestUrgency("potassium", { numeric: 2.6 }), "urgent");
  assert.equal(suggestUrgency("fasting_glucose", { numeric: 2.5 }), "urgent");
});

test("fever triage flags dengue and low platelets", () => {
  assert.equal(suggestUrgency("dengue_ns1", { text: "positive" }), "urgent");
  assert.equal(suggestUrgency("dengue_ns1", { text: "negative" }), null);
  assert.equal(suggestUrgency("platelets", { numeric: 85 }), "urgent");
  assert.equal(suggestUrgency("platelets", { numeric: 15 }), "critical");
  assert.equal(suggestUrgency("platelets", { numeric: 250 }), null);
});

test("blood pressure is parsed from text and graded", () => {
  assert.deepEqual(parseBloodPressure("150 / 95"), { systolic: 150, diastolic: 95 });
  assert.equal(parseBloodPressure("high"), null);
  assert.equal(suggestUrgency("blood_pressure", { text: "128/82" }), null);
  assert.equal(suggestUrgency("blood_pressure", { text: "145/85" }), "routine");
  assert.equal(suggestUrgency("blood_pressure", { text: "165/90" }), "soon");
  assert.equal(suggestUrgency("blood_pressure", { text: "190/100" }), "urgent");
});

test("unknown tests and unreadable values are left for the doctor", () => {
  assert.equal(suggestUrgency("nope", { numeric: 1 }), null);
  assert.equal(suggestUrgency("hba1c", { numeric: null }), null);
  assert.equal(formatResultValue("mammogram", { text: "4" }), "BI-RADS 4 (suspicious)");
  assert.equal(formatResultValue("hba1c", { numeric: 7.1 }), "7.1 %");
});

// ---- Workflow ----

test("due dates follow the fixed service levels by urgency", () => {
  const start = new Date("2026-11-01T00:00:00.000Z");
  assert.equal(computeDueAt("triaged", "critical", start)?.toISOString(), "2026-11-01T08:00:00.000Z");
  assert.equal(computeDueAt("triaged", "urgent", start)?.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(computeDueAt("triaged", "soon", start)?.toISOString(), "2026-11-06T00:00:00.000Z");
  assert.equal(computeDueAt("triaged", "routine", start)?.toISOString(), "2026-11-11T00:00:00.000Z");
  assert.equal(computeDueAt("closed", "routine", start), null);
});

test("cases only move forward", () => {
  assert.equal(canAdvanceTo("notified", "acknowledged"), true);
  assert.equal(canAdvanceTo("notified", "attended"), true);
  assert.equal(canAdvanceTo("referred", "notified"), false);
  assert.equal(canAdvanceTo("attended", "closed"), false);
});

test("escalation goes owner, then doctor after 24 h, then admin after 72 h", () => {
  const due = new Date("2026-11-01T00:00:00.000Z");
  const at = (hours: number) => new Date(due.getTime() + hours * 3600_000);
  assert.equal(escalationTier(due, "soon", at(-1)), "none");
  assert.equal(escalationTier(due, "soon", at(2)), "owner");
  assert.equal(escalationTier(due, "critical", at(2)), "doctor");
  assert.equal(escalationTier(due, "soon", at(30)), "doctor");
  assert.equal(escalationTier(due, "soon", at(80)), "admin");
  assert.equal(escalationTier(null, "soon", at(80)), "none");
});

test("three contact attempts without acknowledgement need a doctor's decision", () => {
  assert.equal(needsDoctorDecision({ state: "notified", contactAttempts: 2 }), false);
  assert.equal(needsDoctorDecision({ state: "notified", contactAttempts: 3 }), true);
  assert.equal(needsDoctorDecision({ state: "acknowledged", contactAttempts: 5 }), false);
});

test("reminders fall due at 24 h and 72 h after notification", () => {
  const notified = "2026-11-01T00:00:00.000Z";
  assert.equal(nextReminderDue(notified, 0)?.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(nextReminderDue(notified, 1)?.toISOString(), "2026-11-04T00:00:00.000Z");
  assert.equal(nextReminderDue(notified, 2), null);
});

test("closure needs evidence or a doctor's sign-off", () => {
  assert.deepEqual(checkClosure({ role: "nurse", state: "attended", reason: "completed", note: "Seen by GI" }), { ok: true });
  assert.equal(checkClosure({ role: "nurse", state: "notified", reason: "completed", note: "x" }).ok, false);
  assert.equal(checkClosure({ role: "nurse", state: "notified", reason: "declined", note: "x" }).ok, false);
  assert.equal(checkClosure({ role: "doctor", state: "notified", reason: "declined", note: "Declined after call" }).ok, true);
  assert.equal(checkClosure({ role: "doctor", state: "notified", reason: "declined", note: "  " }).ok, false);
  assert.equal(checkClosure({ role: "doctor", state: "acknowledged", reason: "resolved_on_repeat", note: "x" }).ok, false);
  assert.equal(checkClosure({ role: "doctor", state: "confirmed", reason: "resolved_on_repeat", note: "Repeat normal" }).ok, true);
  assert.equal(checkClosure({ role: "receptionist", state: "in_care", reason: "completed", note: "x" }).ok, false);
});

test("worklists classify cases", () => {
  const now = new Date("2026-11-05T00:00:00.000Z");
  const base = {
    state: "notified" as const,
    owner_staff_id: "me",
    current_step_due_at: "2026-11-04T00:00:00.000Z",
    referral_rejected: false,
  };
  assert.equal(matchesWorklist(base, "mine", "me", now), true);
  assert.equal(matchesWorklist(base, "mine", "you", now), false);
  assert.equal(matchesWorklist(base, "overdue", "me", now), true);
  assert.equal(matchesWorklist(base, "awaiting_patient", "me", now), true);
  assert.equal(matchesWorklist({ ...base, state: "closed" }, "overdue", "me", now), false);
  assert.equal(matchesWorklist({ ...base, referral_rejected: true }, "referral_rejected", "me", now), true);
});

// ---- Messages and links ----

test("patient messages never contain result details", () => {
  for (const language of ["en", "ms"] as const) {
    for (const kind of ["result_notice", "reminder"] as const) {
      const text = buildPatientMessage({
        kind,
        language,
        patientFirstName: "Aina",
        clinicName: "Klinik Rimbun",
        link: "https://example.test/r/abc",
      });
      assert.match(text, /https:\/\/example\.test\/r\/abc/);
      assert.match(text, /Aina/);
      for (const test of TEST_CATALOGUE) {
        assert.ok(!text.includes(test.label), `${language} ${kind} mentions ${test.label}`);
      }
    }
  }
});

test("Malaysian phone numbers are normalised for wa.me", () => {
  assert.equal(normalizePhone("012-345 6789"), "60123456789");
  assert.equal(normalizePhone("+60 12-345 6789"), "60123456789");
  assert.equal(normalizePhone("0060123456789"), "60123456789");
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(buildWhatsAppLink("0123456789", "hi there"), "https://wa.me/60123456789?text=hi%20there");
});

test("patients verify with date of birth, or IC last four when no date of birth", () => {
  assert.equal(parseDateOfBirthInput("05/03/1971"), "1971-03-05");
  assert.equal(parseDateOfBirthInput("1971-3-5"), "1971-03-05");
  assert.equal(parseDateOfBirthInput("31/02/1971"), null);
  const withDob = { date_of_birth: "1971-03-05", ic_number: "710305-10-5544" };
  assert.equal(verifyPatientIdentity(withDob, "05-03-1971"), true);
  assert.equal(verifyPatientIdentity(withDob, "5544"), false);
  const icOnly = { date_of_birth: null, ic_number: "710305-10-5544" };
  assert.equal(verifyPatientIdentity(icOnly, "5544"), true);
  assert.equal(verifyPatientIdentity({ date_of_birth: null, ic_number: null }, ""), false);
});

test("teach-back always includes exactly one correct answer", () => {
  for (const step of ["clinic_review", "repeat_test", "referral", "same_day_review"] as const) {
    const options = teachBackOptions(step, "en");
    assert.equal(options.length, 3);
    assert.equal(options.filter((option) => option.correct).length, 1);
    assert.equal(options.find((option) => option.correct)?.value, step);
    assert.deepEqual(teachBackOptions(step, "en"), options, "stable order");
  }
});

test("patient tracker marks done and current steps", () => {
  const tracker = patientTracker("acknowledged", "referral");
  assert.deepEqual(
    tracker.map((step) => [step.key, step.done, step.current]),
    [
      ["ready", true, false],
      ["read", true, false],
      ["next", false, true],
      ["care", false, false],
    ]
  );
});

test("link tokens are random, hashed and expire", () => {
  const now = new Date("2026-11-01T00:00:00.000Z");
  const first = generateLinkToken(now);
  const second = generateLinkToken(now);
  assert.notEqual(first.token, second.token);
  assert.equal(isWellFormedToken(first.token), true);
  assert.equal(isWellFormedToken("../etc"), false);
  assert.equal(first.hash, hashLinkToken(first.token));
  assert.equal(first.hash.length, 64);
  assert.equal(isLinkExpired(first.expiresAt, new Date("2026-11-30T00:00:00.000Z")), false);
  assert.equal(isLinkExpired(first.expiresAt, new Date("2026-12-01T00:00:00.000Z")), true);
});

// ---- Metrics ----

test("median handles odd, even and empty inputs", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test("loop metrics come from case milestones", () => {
  const now = new Date("2026-11-30T00:00:00.000Z");
  const base: MetricsCase = {
    state: "closed",
    result_reported_at: "2026-11-01T00:00:00.000Z",
    opened_at: "2026-11-01T02:00:00.000Z",
    notified_at: "2026-11-01T04:00:00.000Z",
    acknowledged_at: "2026-11-01T10:00:00.000Z",
    understanding_correct: true,
    care_started_at: "2026-11-08T00:00:00.000Z",
    closed_at: "2026-11-10T00:00:00.000Z",
    closure_reason: "completed",
    current_step_due_at: null,
  };
  const metrics = computeLoopMetrics(
    [
      base,
      { ...base, notified_at: "2026-11-01T08:00:00.000Z", understanding_correct: false, closure_reason: "declined" },
      {
        ...base,
        state: "notified",
        opened_at: "2026-11-20T00:00:00.000Z",
        notified_at: "2026-11-21T00:00:00.000Z",
        acknowledged_at: null,
        understanding_correct: null,
        care_started_at: null,
        closed_at: null,
        closure_reason: null,
        current_step_due_at: "2026-11-24T00:00:00.000Z",
      },
    ],
    [{ status: "attended" }, { status: "rejected" }, { status: "booked" }, { status: "attended" }],
    now
  );

  assert.equal(metrics.openCases, 1);
  assert.equal(metrics.overdueCases, 1);
  assert.deepEqual(metrics.openByAge, { upTo7: 0, from8To30: 1, over30: 0 });
  assert.equal(metrics.medianHoursToNotification, 8);
  assert.equal(metrics.medianDaysToCare, 7);
  assert.equal(metrics.referralCompletionPercent, 50);
  assert.equal(metrics.referralRejectionPercent, 25);
  assert.equal(metrics.closedWithEvidencePercent, 50);
  assert.deepEqual(metrics.dropOffReasons, { declined: 1 });
  assert.equal(metrics.understandingPercent, 50);
});

// ---- Referral letter, routing ----

test("referral letter is drafted from the case and consultation", () => {
  const letter = buildReferralLetter({
    clinic: { name: "Rimbun Demo Clinic", address: "PJ", phone: "03-1234" },
    doctor: { full_name: "Dr Lim", mmc_number: "12345" },
    patient: {
      full_name: "Rosnah Ismail",
      ic_number: "640101-01-1234",
      mrn: "MRN-1",
      date_of_birth: "1964-01-01",
      gender: "female",
      phone: null,
      allergies: [],
    },
    receiving: { facility: "Hospital Sultanah", clinician: null, specialty: "Gastroenterology" },
    result: { testLabel: "FIT", value: "Positive", collectedOn: "2026-10-20", source: "Lab A" },
    urgencyLabel: "Soon",
    reason: "Positive FIT, please assess for colonoscopy.",
    diagnoses: [],
    medications: ["Metformin 500 mg BD"],
    conditions: ["Type 2 diabetes"],
    vitals: null,
    today: "2026-11-01",
  });
  assert.match(letter, /Re: Rosnah Ismail \(62 years, female/);
  assert.match(letter, /To: Gastroenterology, Hospital Sultanah/);
  assert.match(letter, /- FIT: Positive \(collected 2026-10-20\), Lab A/);
  assert.match(letter, /- Metformin 500 mg BD/);
  assert.match(letter, /Allergies: No known allergies/);
});

test("Care Loop module is implemented, on by default and can be turned off", () => {
  assert.equal(isModuleImplemented("loop"), true);
  assert.equal(isModuleVisibleInNav({}, "loop"), true);
  assert.equal(isModuleVisibleInNav({ modules: { loop: false } }, "loop"), false);
});

test("dates render in the clinic's time zone (Asia/Kuala_Lumpur by default)", () => {
  assert.equal(formatClinicDateTime("2026-11-10T01:30:00Z"), "10 Nov 2026, 9:30 am");
  assert.equal(formatClinicDate("2026-10-31"), "31 Oct 2026");
  assert.equal(clinicToday(new Date("2026-11-01T17:00:00Z")), "2026-11-02");
  // A date-only appointment is stored as clinic midnight and shown without a time.
  assert.equal(clinicDateStart("2026-11-10"), "2026-11-09T16:00:00.000Z");
  assert.equal(formatClinicDateTime(clinicDateStart("2026-11-10")), "10 Nov 2026");
});
