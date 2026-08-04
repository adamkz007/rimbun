import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessPathname,
  getAccessRuleForPath,
  hasAccess,
  hasModuleAccess,
  hasRoleAccess,
  isPublicPath,
} from "../src/lib/rbac";

const demoSettings = {
  modules: {
    clerking: true,
    queue: true,
    billing: true,
    dispensary: true,
    enquiry: true,
    attendance: true,
  },
};

test("isPublicPath allows login and landing routes", () => {
  assert.equal(isPublicPath("/"), true);
  assert.equal(isPublicPath("/login"), true);
  assert.equal(isPublicPath("/dashboard"), false);
});

test("hasRoleAccess respects configured role lists", () => {
  assert.equal(hasRoleAccess("doctor", ["doctor", "nurse"]), true);
  assert.equal(hasRoleAccess("receptionist", ["doctor", "nurse"]), false);
  assert.equal(hasRoleAccess("admin"), true);
});

test("hasModuleAccess follows clinic module flags", () => {
  assert.equal(hasModuleAccess(demoSettings, "billing"), true);
  assert.equal(hasModuleAccess({ modules: { billing: false } }, "billing"), false);
  assert.equal(hasModuleAccess(demoSettings), true);
});

test("getAccessRuleForPath matches nested routes by prefix", () => {
  assert.equal(getAccessRuleForPath("/clerking/abc")?.module, "clerking");
  assert.equal(getAccessRuleForPath("/billing/invoice-1")?.module, "billing");
  assert.equal(getAccessRuleForPath("/attendance")?.module, "attendance");
  assert.equal(getAccessRuleForPath("/api/search/icd10")?.module, "clerking");
});

test("hasAccess combines role and module gates", () => {
  assert.equal(
    hasAccess({
      role: "doctor",
      clinicSettings: demoSettings,
      access: { roles: ["doctor", "nurse"], module: "clerking" },
    }),
    true
  );
  assert.equal(
    hasAccess({
      role: "receptionist",
      clinicSettings: demoSettings,
      access: { roles: ["doctor", "nurse"], module: "clerking" },
    }),
    false
  );
  assert.equal(
    hasAccess({
      role: "doctor",
      clinicSettings: { modules: { clerking: false } },
      access: { roles: ["doctor"], module: "clerking" },
    }),
    false
  );
});

test("canAccessPathname enforces protected route matrix", () => {
  assert.equal(
    canAccessPathname({
      pathname: "/dispensary",
      role: "nurse",
      clinicSettings: demoSettings,
    }),
    true
  );
  assert.equal(
    canAccessPathname({
      pathname: "/billing",
      role: "doctor",
      clinicSettings: demoSettings,
    }),
    false
  );
  assert.equal(
    canAccessPathname({
      pathname: "/attendance",
      role: "receptionist",
      clinicSettings: demoSettings,
    }),
    true
  );
  assert.equal(
    canAccessPathname({
      pathname: "/settings",
      role: "admin",
      clinicSettings: demoSettings,
    }),
    true
  );
});
