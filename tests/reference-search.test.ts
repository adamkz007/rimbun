import test from "node:test";
import assert from "node:assert/strict";
import {
  clampSearchLimit,
  normalizeReferenceSearchInput,
  prepareDrugSearch,
  prepareIcd10Search,
  searchDrugRecords,
  searchIcd10Records,
  shapeDrugSearchResults,
  shapeIcd10SearchResults,
} from "../src/lib/reference-search.ts";

test("clampSearchLimit bounds invalid and oversized input", () => {
  assert.equal(clampSearchLimit(undefined), 10);
  assert.equal(clampSearchLimit("abc"), 10);
  assert.equal(clampSearchLimit("0"), 1);
  assert.equal(clampSearchLimit("99"), 20);
});

test("normalizeReferenceSearchInput trims and normalizes punctuation", () => {
  assert.equal(normalizeReferenceSearchInput("  Type-2   DM  "), "type 2 dm");
  assert.equal(normalizeReferenceSearchInput("I10."), "i10.");
});

test("prepareIcd10Search expands common abbreviations and query limits", () => {
  const prepared = prepareIcd10Search("HTN", "40");

  assert.equal(prepared.normalizedQuery, "htn");
  assert.equal(prepared.expandedQuery, "htn hypertension");
  assert.equal(prepared.limit, 20);
  assert.equal(prepared.shouldSearch, true);
});

test("prepareDrugSearch expands drug aliases and blocks short queries", () => {
  const aliasPrepared = prepareDrugSearch("pcm", 8);
  const shortPrepared = prepareDrugSearch("a", 8);

  assert.equal(aliasPrepared.expandedQuery, "pcm paracetamol");
  assert.equal(aliasPrepared.shouldSearch, true);
  assert.equal(shortPrepared.shouldSearch, false);
});

test("shapeIcd10SearchResults coerces response rows into API shape", () => {
  assert.deepEqual(
    shapeIcd10SearchResults([
      { code: "I10", description: "Essential hypertension", category: "Diseases of the circulatory system" },
      { code: 42, description: null, category: undefined },
    ]),
    [
      {
        code: "I10",
        description: "Essential hypertension",
        category: "Diseases of the circulatory system",
      },
      {
        code: "",
        description: "",
        category: null,
      },
    ]
  );
});

test("shapeDrugSearchResults coerces nullable drug fields", () => {
  assert.deepEqual(
    shapeDrugSearchResults([
      {
        id: "drug-1",
        name: "Paracetamol",
        generic_name: "Paracetamol",
        formulation: "Tablet",
        strength: "500mg",
      },
      {
        id: null,
        name: null,
        generic_name: undefined,
        formulation: "",
        strength: 500,
      },
    ]),
    [
      {
        id: "drug-1",
        name: "Paracetamol",
        generic_name: "Paracetamol",
        formulation: "Tablet",
        strength: "500mg",
      },
      {
        id: "",
        name: "",
        generic_name: null,
        formulation: null,
        strength: null,
      },
    ]
  );
});

test("searchIcd10Records forwards ranked-query arguments to the RPC layer", async () => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const prepared = prepareIcd10Search("htn", 8);
  const supabase = {
    async rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return {
        data: [{ code: "I10", description: "Essential hypertension", category: "Diseases of the circulatory system" }],
        error: null,
      };
    },
  };

  const result = await searchIcd10Records(supabase, prepared);

  assert.deepEqual(calls, [
    {
      fn: "search_icd10_codes",
      args: {
        query_text: "htn hypertension",
        raw_query_text: "htn",
        result_limit: 8,
      },
    },
  ]);
  assert.equal(result.error, null);
  assert.deepEqual(result.data, [
    {
      code: "I10",
      description: "Essential hypertension",
      category: "Diseases of the circulatory system",
    },
  ]);
});

test("searchDrugRecords skips RPC calls for too-short queries", async () => {
  let called = false;
  const supabase = {
    async rpc() {
      called = true;
      return { data: [], error: null };
    },
  };

  const result = await searchDrugRecords(supabase, prepareDrugSearch("x", 5));

  assert.equal(called, false);
  assert.equal(result.error, null);
  assert.deepEqual(result.data, []);
});

test("searchDrugRecords shapes ranked results and surfaces RPC failures", async () => {
  const prepared = prepareDrugSearch("pcm", 5);
  const successSupabase = {
    async rpc() {
      return {
        data: [
          {
            id: "drug-1",
            name: "Paracetamol",
            generic_name: "Paracetamol",
            formulation: "Tablet",
            strength: "500mg",
          },
        ],
        error: null,
      };
    },
  };
  const failureSupabase = {
    async rpc() {
      return {
        data: null,
        error: { message: "database exploded" },
      };
    },
  };

  const success = await searchDrugRecords(successSupabase, prepared);
  const failure = await searchDrugRecords(failureSupabase, prepared);

  assert.deepEqual(success.data, [
    {
      id: "drug-1",
      name: "Paracetamol",
      generic_name: "Paracetamol",
      formulation: "Tablet",
      strength: "500mg",
    },
  ]);
  assert.equal(success.error, null);
  assert.equal(failure.data, null);
  assert.deepEqual(failure.error, {
    message: "database exploded",
    status: 500,
  });
});
