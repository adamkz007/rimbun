create extension if not exists pg_trgm with schema extensions;

create unique index if not exists idx_drugs_unique_search_identity
  on drugs (
    lower(name),
    lower(coalesce(generic_name, '')),
    lower(coalesce(formulation, '')),
    lower(coalesce(strength, ''))
  );

create index if not exists idx_icd10_codes_code_lower
  on icd10_codes (lower(code));

create index if not exists idx_icd10_codes_description_trgm
  on icd10_codes
  using gin (lower(description) extensions.gin_trgm_ops);

create index if not exists idx_icd10_codes_category_trgm
  on icd10_codes
  using gin (lower(coalesce(category, '')) extensions.gin_trgm_ops);

create index if not exists idx_drugs_name_trgm
  on drugs
  using gin (lower(name) extensions.gin_trgm_ops);

create index if not exists idx_drugs_generic_name_trgm
  on drugs
  using gin (lower(coalesce(generic_name, '')) extensions.gin_trgm_ops);

create or replace function search_icd10_codes(
  query_text text,
  raw_query_text text default null,
  result_limit integer default 10
)
returns table (
  code text,
  description text,
  category text
)
language sql
stable
as $$
  with params as (
    select
      trim(lower(coalesce(query_text, ''))) as expanded_query,
      trim(lower(coalesce(raw_query_text, query_text, ''))) as raw_query,
      least(greatest(coalesce(result_limit, 10), 1), 20) as applied_limit
  ),
  ranked as (
    select
      icd10.code,
      icd10.description,
      icd10.category,
      (
        case
          when lower(icd10.code) = params.raw_query then 600
          when replace(lower(icd10.code), '.', '') = replace(params.raw_query, '.', '') then 520
          when lower(icd10.code) like params.raw_query || '%' then 380
          else 0
        end
      ) +
      (
        case
          when lower(icd10.description) = params.raw_query then 260
          when lower(icd10.description) like params.raw_query || '%' then 190
          when lower(icd10.description) like '% ' || params.raw_query || '%' then 150
          when lower(coalesce(icd10.category, '')) like params.raw_query || '%' then 110
          else 0
        end
      ) +
      (
        coalesce(
          ts_rank_cd(
            icd10.search_vector,
            websearch_to_tsquery('english', params.expanded_query)
          ),
          0
        ) * 100
      ) +
      (
        greatest(
          extensions.similarity(lower(icd10.code), params.raw_query),
          extensions.similarity(lower(icd10.description), params.raw_query),
          extensions.similarity(lower(coalesce(icd10.category, '')), params.raw_query)
        ) * 60
      ) as score
    from icd10_codes as icd10
    cross join params
    where
      params.raw_query <> ''
      and (
        icd10.search_vector @@ websearch_to_tsquery('english', params.expanded_query)
        or lower(icd10.code) like params.raw_query || '%'
        or lower(icd10.description) like '%' || params.raw_query || '%'
        or lower(coalesce(icd10.category, '')) like '%' || params.raw_query || '%'
        or extensions.similarity(lower(icd10.code), params.raw_query) > 0.20
        or extensions.similarity(lower(icd10.description), params.raw_query) > 0.16
      )
  ),
  numbered as (
    select
      ranked.code,
      ranked.description,
      ranked.category,
      row_number() over (order by ranked.score desc, ranked.code asc) as row_num
    from ranked
  )
  select numbered.code, numbered.description, numbered.category
  from numbered
  cross join params
  where numbered.row_num <= params.applied_limit;
$$;

create or replace function search_drugs(
  query_text text,
  raw_query_text text default null,
  result_limit integer default 10
)
returns table (
  id uuid,
  name text,
  generic_name text,
  formulation text,
  strength text
)
language sql
stable
as $$
  with params as (
    select
      trim(lower(coalesce(query_text, ''))) as expanded_query,
      trim(lower(coalesce(raw_query_text, query_text, ''))) as raw_query,
      least(greatest(coalesce(result_limit, 10), 1), 20) as applied_limit
  ),
  ranked as (
    select
      drugs.id,
      drugs.name,
      drugs.generic_name,
      drugs.formulation,
      drugs.strength,
      (
        case
          when lower(drugs.name) = params.raw_query then 420
          when lower(coalesce(drugs.generic_name, '')) = params.raw_query then 390
          when lower(drugs.name) like params.raw_query || '%' then 260
          when lower(coalesce(drugs.generic_name, '')) like params.raw_query || '%' then 240
          else 0
        end
      ) +
      (
        case
          when lower(coalesce(drugs.strength, '')) = params.raw_query then 120
          when lower(coalesce(drugs.formulation, '')) = params.raw_query then 100
          when lower(coalesce(drugs.formulation, '')) like params.raw_query || '%' then 80
          else 0
        end
      ) +
      (
        coalesce(
          ts_rank_cd(
            drugs.search_vector,
            websearch_to_tsquery('english', params.expanded_query)
          ),
          0
        ) * 100
      ) +
      (
        greatest(
          extensions.similarity(lower(drugs.name), params.raw_query),
          extensions.similarity(lower(coalesce(drugs.generic_name, '')), params.raw_query),
          extensions.similarity(lower(coalesce(drugs.formulation, '')), params.raw_query),
          extensions.similarity(lower(coalesce(drugs.strength, '')), params.raw_query)
        ) * 55
      ) as score
    from drugs
    cross join params
    where
      params.raw_query <> ''
      and (
        drugs.search_vector @@ websearch_to_tsquery('english', params.expanded_query)
        or lower(drugs.name) like '%' || params.raw_query || '%'
        or lower(coalesce(drugs.generic_name, '')) like '%' || params.raw_query || '%'
        or lower(coalesce(drugs.formulation, '')) like '%' || params.raw_query || '%'
        or lower(coalesce(drugs.strength, '')) like '%' || params.raw_query || '%'
        or extensions.similarity(lower(drugs.name), params.raw_query) > 0.18
        or extensions.similarity(lower(coalesce(drugs.generic_name, '')), params.raw_query) > 0.18
      )
  ),
  numbered as (
    select
      ranked.id,
      ranked.name,
      ranked.generic_name,
      ranked.formulation,
      ranked.strength,
      row_number() over (
        order by ranked.score desc, ranked.name asc, ranked.strength asc nulls last
      ) as row_num
    from ranked
  )
  select numbered.id, numbered.name, numbered.generic_name, numbered.formulation, numbered.strength
  from numbered
  cross join params
  where numbered.row_num <= params.applied_limit;
$$;

grant execute on function search_icd10_codes(text, text, integer) to authenticated;
grant execute on function search_drugs(text, text, integer) to authenticated;
