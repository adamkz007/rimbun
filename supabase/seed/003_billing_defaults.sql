-- Default fee catalog and billing module flag for local development

update clinics
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{modules,billing}',
  'true'::jsonb,
  true
)
where slug = 'rimbun-demo';

insert into fee_catalog (clinic_id, code, description, category, unit_amount, sort_order)
select
  clinics.id,
  fee.code,
  fee.description,
  fee.category,
  fee.unit_amount,
  fee.sort_order
from clinics
cross join (
  values
    ('CONSULT', 'General consultation', 'consultation', 50.00, 0),
    ('MED-DISP', 'Medication dispensing fee', 'medication', 15.00, 1),
    ('PROC-BASIC', 'Basic procedure', 'procedure', 30.00, 2),
    ('ADMIN', 'Administrative fee', 'other', 10.00, 3)
) as fee(code, description, category, unit_amount, sort_order)
where clinics.slug = 'rimbun-demo'
on conflict (clinic_id, code) do update
set
  description = excluded.description,
  category = excluded.category,
  unit_amount = excluded.unit_amount,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
