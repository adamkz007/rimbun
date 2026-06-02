-- Reference data tables for medical autocomplete

create table icd10_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  category text,
  search_vector tsvector generated always as (
    to_tsvector('english', code || ' ' || description || ' ' || coalesce(category, ''))
  ) stored
);

create table drugs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  generic_name text,
  formulation text,
  strength text,
  manufacturer text,
  is_controlled boolean default false,
  search_vector tsvector generated always as (
    to_tsvector('english', name || ' ' || coalesce(generic_name, '') || ' ' || coalesce(formulation, ''))
  ) stored
);

create index idx_icd10_search on icd10_codes using gin(search_vector);
create index idx_drugs_search on drugs using gin(search_vector);
