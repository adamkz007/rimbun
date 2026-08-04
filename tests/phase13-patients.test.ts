import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_PATIENT_FORM_VALUES,
  parseMedicalHistory,
  parsePatientFormInput,
  patientToFormValues,
  toPatientFieldErrors,
} from "../src/lib/patients";

test("parseMedicalHistory normalizes stored json fields", () => {
  const history = parseMedicalHistory({
    conditions: ["Hypertension", "  "],
    currentMedications: ["Metformin"],
    surgicalHistory: "Appendectomy",
    familyHistory: "",
    socialHistory: null,
    notes: "Follow-up needed",
  });

  assert.deepEqual(history.conditions, ["Hypertension"]);
  assert.deepEqual(history.currentMedications, ["Metformin"]);
  assert.equal(history.surgicalHistory, "Appendectomy");
  assert.equal(history.familyHistory, null);
  assert.equal(history.notes, "Follow-up needed");
});

test("patientToFormValues maps database record to form state", () => {
  const values = patientToFormValues({
    full_name: "Ali Rahman",
    ic_number: "900101-01-1234",
    date_of_birth: "1990-01-01",
    gender: "male",
    phone: "+60123456789",
    email: "ali@example.com",
    address: "Kuala Lumpur",
    emergency_contact_name: "Siti",
    emergency_contact_phone: "+60111111111",
    allergies: ["Penicillin"],
    medical_history: {
      conditions: ["Asthma"],
      currentMedications: ["Salbutamol"],
      surgicalHistory: null,
      familyHistory: null,
      socialHistory: null,
      notes: null,
    },
  });

  assert.equal(values.fullName, "Ali Rahman");
  assert.equal(values.allergies, "Penicillin");
  assert.equal(values.medicalConditions, "Asthma");
});

test("parsePatientFormInput validates required patient fields", () => {
  const valid = parsePatientFormInput({
    ...EMPTY_PATIENT_FORM_VALUES,
    fullName: "Siti Aminah",
    phone: "+60123456789",
  });
  assert.equal(valid.success, true);

  const invalid = parsePatientFormInput({
    ...EMPTY_PATIENT_FORM_VALUES,
    fullName: "A",
    email: "not-an-email",
  });
  assert.equal(invalid.success, false);
  if (!invalid.success) {
    const fieldErrors = toPatientFieldErrors(invalid.error.issues);
    assert.ok(fieldErrors.fullName || fieldErrors.email);
  }
});

test("parsePatientFormInput trims optional empty strings", () => {
  const parsed = parsePatientFormInput({
    ...EMPTY_PATIENT_FORM_VALUES,
    fullName: "Raj Kumar",
    icNumber: "   ",
    email: "",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.icNumber, undefined);
    assert.equal(parsed.data.email, undefined);
  }
});
