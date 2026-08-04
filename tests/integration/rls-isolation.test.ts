import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntegrationAdminClient,
  createIntegrationAnonClient,
  getIntegrationEnv,
  signInDemoDoctor,
} from "./helpers";

type ClinicRow = { id: string; slug: string };

test("RLS isolates clinic-owned patient rows between tenants", async (t) => {
  const env = getIntegrationEnv();
  if (!env) {
    t.skip("Supabase integration env vars are not configured.");
    return;
  }

  const admin = createIntegrationAdminClient(env.url, env.serviceRoleKey);
  const { data: clinics, error: clinicsError } = await admin
    .from("clinics")
    .select("id, slug")
    .in("slug", ["rimbun-demo", "rimbun-other"]);

  assert.ifError(clinicsError);
  const clinicRows = (clinics ?? []) as ClinicRow[];
  assert.equal(clinicRows.length, 2);

  const demoClinicId = clinicRows.find((clinic) => clinic.slug === "rimbun-demo")?.id;
  const otherClinicId = clinicRows.find((clinic) => clinic.slug === "rimbun-other")?.id;
  assert.ok(demoClinicId);
  assert.ok(otherClinicId);

  const client = createIntegrationAnonClient(env.url, env.anonKey);
  await signInDemoDoctor(client);

  const { data: patients, error } = await client
    .from("patients")
    .select("clinic_id, mrn")
    .eq("mrn", "P99999");

  assert.ifError(error);
  assert.equal(patients?.length ?? 0, 0);

  const { count: demoCount } = await admin
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", demoClinicId);

  const { count: otherCount } = await admin
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", otherClinicId);

  assert.ok((demoCount ?? 0) > 0);
  assert.ok((otherCount ?? 0) > 0);
});
