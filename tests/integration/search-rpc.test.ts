import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntegrationAdminClient,
  getIntegrationEnv,
} from "./helpers";
import {
  prepareDrugSearch,
  prepareIcd10Search,
  searchDrugRecords,
  searchIcd10Records,
  type ReferenceSearchClient,
} from "../../src/lib/reference-search";

test("search RPCs return expected reference matches after seed", async (t) => {
  const env = getIntegrationEnv();
  if (!env) {
    t.skip("Supabase integration env vars are not configured.");
    return;
  }

  const admin = createIntegrationAdminClient(env.url, env.serviceRoleKey) as ReferenceSearchClient;

  const diabetes = await searchIcd10Records(admin, prepareIcd10Search("diabetes", 5));
  assert.ifError(diabetes.error);
  assert.ok((diabetes.data?.length ?? 0) > 0);
  assert.ok(
    diabetes.data?.some((item) => item.description.toLowerCase().includes("diabetes"))
  );

  const hypertension = await searchIcd10Records(admin, prepareIcd10Search("hypertension", 5));
  assert.ifError(hypertension.error);
  assert.ok((hypertension.data?.length ?? 0) > 0);

  const metformin = await searchDrugRecords(admin, prepareDrugSearch("metformin", 5));
  assert.ifError(metformin.error);
  assert.ok((metformin.data?.length ?? 0) > 0);

  const amlodipine = await searchDrugRecords(admin, prepareDrugSearch("amlodipine", 5));
  assert.ifError(amlodipine.error);
  assert.ok((amlodipine.data?.length ?? 0) > 0);
});
