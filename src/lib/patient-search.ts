export const DEFAULT_PATIENT_SEARCH_LIMIT = 5;
export const MAX_PATIENT_SEARCH_LIMIT = 20;
export const MIN_PATIENT_SEARCH_QUERY_LENGTH = 2;

export function clampPatientSearchLimit(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PATIENT_SEARCH_LIMIT;
  }

  return Math.min(parsed, MAX_PATIENT_SEARCH_LIMIT);
}

export function escapePatientSearchQuery(query: string) {
  return query.replace(/[%_,]/g, "");
}

export function isPatientSearchQueryValid(query: string | null | undefined) {
  return Boolean(query && query.length >= MIN_PATIENT_SEARCH_QUERY_LENGTH);
}

export function buildPatientSearchFilter(query: string) {
  const escapedQuery = escapePatientSearchQuery(query);
  return `full_name.ilike.%${escapedQuery}%,mrn.ilike.%${escapedQuery}%,ic_number.ilike.%${escapedQuery}%`;
}
