import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientSearchFilter,
  clampPatientSearchLimit,
  escapePatientSearchQuery,
  isPatientSearchQueryValid,
} from "../src/lib/patient-search";

test("clampPatientSearchLimit bounds invalid and oversized values", () => {
  assert.equal(clampPatientSearchLimit(null), 5);
  assert.equal(clampPatientSearchLimit("0"), 5);
  assert.equal(clampPatientSearchLimit("10"), 10);
  assert.equal(clampPatientSearchLimit("999"), 20);
});

test("escapePatientSearchQuery strips wildcard characters", () => {
  assert.equal(escapePatientSearchQuery("ali%ce_1"), "alice1");
});

test("isPatientSearchQueryValid requires at least two characters", () => {
  assert.equal(isPatientSearchQueryValid("a"), false);
  assert.equal(isPatientSearchQueryValid("al"), true);
  assert.equal(isPatientSearchQueryValid(null), false);
});

test("buildPatientSearchFilter creates ilike filter across patient fields", () => {
  assert.equal(
    buildPatientSearchFilter("ali"),
    "full_name.ilike.%ali%,mrn.ilike.%ali%,ic_number.ilike.%ali%"
  );
});
