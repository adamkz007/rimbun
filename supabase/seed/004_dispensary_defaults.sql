-- Default dispensary module flag and starter inventory for local development

update clinics
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{modules,dispensary}',
  'true'::jsonb,
  true
)
where slug = 'rimbun-demo';

insert into inventory_items (
  clinic_id,
  drug_id,
  name,
  sku,
  formulation,
  strength,
  unit,
  quantity_on_hand,
  reorder_level,
  is_controlled
)
select
  clinics.id,
  drugs.id,
  drugs.name,
  'INV-' || upper(substr(md5(drugs.id::text), 1, 8)),
  drugs.formulation,
  drugs.strength,
  case when drugs.formulation ilike '%tab%' then 'tablet' else 'unit' end,
  case when drugs.is_controlled then 20 else 100 end,
  case when drugs.is_controlled then 5 else 20 end,
  drugs.is_controlled
from clinics
cross join lateral (
  select *
  from drugs
  where lower(name) like 'metformin 500%'
     or lower(name) like 'amlodipine 5 mg tablet%'
     or lower(name) like 'paracetamol 500%'
     or lower(name) like 'amoxicillin 500%'
     or lower(name) like 'salbutamol%inhaler%'
  order by name
  limit 5
) as drugs
where clinics.slug = 'rimbun-demo'
on conflict (clinic_id, sku) do update
set
  name = excluded.name,
  drug_id = excluded.drug_id,
  formulation = excluded.formulation,
  strength = excluded.strength,
  unit = excluded.unit,
  reorder_level = excluded.reorder_level,
  is_controlled = excluded.is_controlled,
  is_active = true,
  updated_at = now();
