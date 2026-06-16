type ReferenceSearchResultError = {
  message: string;
  status: number;
};

type PreparedSearch = {
  rawQuery: string;
  normalizedQuery: string;
  expandedQuery: string;
  limit: number;
  shouldSearch: boolean;
};

type Icd10Row = {
  code?: unknown;
  description?: unknown;
  category?: unknown;
};

type DrugRow = {
  id?: unknown;
  name?: unknown;
  generic_name?: unknown;
  formulation?: unknown;
  strength?: unknown;
};

const MAX_SEARCH_LIMIT = 20;
const DEFAULT_SEARCH_LIMIT = 10;
const MIN_SEARCH_LENGTH = 2;

const ICD10_QUERY_ALIASES: Record<string, string[]> = {
  dm: ["diabetes mellitus"],
  t1dm: ["type 1 diabetes mellitus"],
  t2dm: ["type 2 diabetes mellitus"],
  htn: ["hypertension"],
  uri: ["upper respiratory infection"],
  urti: ["upper respiratory infection"],
  uti: ["urinary tract infection"],
  gerd: ["gastro oesophageal reflux disease", "gastroesophageal reflux disease"],
  oa: ["osteoarthritis"],
  lbp: ["low back pain"],
};

const DRUG_QUERY_ALIASES: Record<string, string[]> = {
  pcm: ["paracetamol"],
  panadol: ["paracetamol"],
  amox: ["amoxicillin"],
  coamox: ["amoxicillin clavulanate", "augmentin"],
  ventolin: ["salbutamol"],
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function clampSearchLimit(limit: string | number | null | undefined) {
  const parsed =
    typeof limit === "number"
      ? limit
      : typeof limit === "string" && limit.trim().length > 0
        ? Number.parseInt(limit, 10)
        : DEFAULT_SEARCH_LIMIT;

  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), MAX_SEARCH_LIMIT);
}

export function normalizeReferenceSearchInput(query: string | null | undefined) {
  if (!query) {
    return "";
  }

  return query
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandReferenceSearchQuery(
  normalizedQuery: string,
  aliases: Record<string, string[]>
) {
  if (!normalizedQuery) {
    return "";
  }

  const expandedTerms = new Set<string>([normalizedQuery]);

  for (const token of normalizedQuery.split(" ")) {
    const mappedValues = aliases[token];

    if (!mappedValues) {
      continue;
    }

    for (const value of mappedValues) {
      expandedTerms.add(value);
    }
  }

  return Array.from(expandedTerms).join(" ");
}

function prepareReferenceSearch(
  query: string | null | undefined,
  limit: string | number | null | undefined,
  aliases: Record<string, string[]>
): PreparedSearch {
  const rawQuery = query ?? "";
  const normalizedQuery = normalizeReferenceSearchInput(rawQuery);

  return {
    rawQuery,
    normalizedQuery,
    expandedQuery: expandReferenceSearchQuery(normalizedQuery, aliases),
    limit: clampSearchLimit(limit),
    shouldSearch: normalizedQuery.length >= MIN_SEARCH_LENGTH,
  };
}

export function prepareIcd10Search(
  query: string | null | undefined,
  limit: string | number | null | undefined
) {
  return prepareReferenceSearch(query, limit, ICD10_QUERY_ALIASES);
}

export function prepareDrugSearch(
  query: string | null | undefined,
  limit: string | number | null | undefined
) {
  return prepareReferenceSearch(query, limit, DRUG_QUERY_ALIASES);
}

export function shapeIcd10SearchResults(rows: Icd10Row[]) {
  return rows.map((row) => ({
    code: asString(row.code),
    description: asString(row.description),
    category: asNullableString(row.category),
  }));
}

export function shapeDrugSearchResults(rows: DrugRow[]) {
  return rows.map((row) => ({
    id: asString(row.id),
    name: asString(row.name),
    generic_name: asNullableString(row.generic_name),
    formulation: asNullableString(row.formulation),
    strength: asNullableString(row.strength),
  }));
}

type ReferenceSearchRpcResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type ReferenceSearchClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<ReferenceSearchRpcResult>;
};

async function invokeReferenceSearchRpc<TShape>(
  supabase: ReferenceSearchClient,
  fn: string,
  prepared: PreparedSearch,
  shape: (rows: Record<string, unknown>[]) => TShape[]
) {
  if (!prepared.shouldSearch) {
    return { data: [] as TShape[], error: null };
  }

  const { data, error } = await supabase.rpc(fn, {
    query_text: prepared.expandedQuery,
    raw_query_text: prepared.normalizedQuery,
    result_limit: prepared.limit,
  });

  if (error) {
    const responseError: ReferenceSearchResultError = {
      message: error.message || "Search failed",
      status: 500,
    };

    return { data: null, error: responseError };
  }

  return {
    data: shape((data ?? []) as Record<string, unknown>[]),
    error: null,
  };
}

export async function searchIcd10Records(
  supabase: ReferenceSearchClient,
  prepared: PreparedSearch
) {
  return invokeReferenceSearchRpc(supabase, "search_icd10_codes", prepared, shapeIcd10SearchResults);
}

export async function searchDrugRecords(
  supabase: ReferenceSearchClient,
  prepared: PreparedSearch
) {
  return invokeReferenceSearchRpc(supabase, "search_drugs", prepared, shapeDrugSearchResults);
}
