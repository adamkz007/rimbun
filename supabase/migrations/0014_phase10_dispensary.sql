-- Phase 10: Dispensary — inventory, fulfillment, and stock movements

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  drug_id uuid references drugs(id) on delete set null,
  name text not null,
  sku text,
  formulation text,
  strength text,
  unit text not null default 'unit',
  quantity_on_hand int not null default 0 check (quantity_on_hand >= 0),
  reorder_level int not null default 10 check (reorder_level >= 0),
  is_controlled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, sku)
);

create index idx_inventory_items_clinic_active on inventory_items(clinic_id, is_active, name);
create index idx_inventory_items_clinic_drug on inventory_items(clinic_id, drug_id) where drug_id is not null;

create table dispensary_fulfillments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  encounter_id uuid not null references encounters(id) on delete cascade,
  encounter_prescription_id uuid not null references encounter_prescriptions(id) on delete cascade,
  patient_id uuid not null references patients(id),
  inventory_item_id uuid references inventory_items(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'dispensed', 'cancelled')),
  drug_name text not null,
  dosage text not null,
  quantity_requested int not null check (quantity_requested > 0),
  quantity_dispensed int check (quantity_dispensed is null or quantity_dispensed > 0),
  is_controlled boolean not null default false,
  controlled_verified_by uuid references staff(id),
  dispensed_at timestamptz,
  dispensed_by uuid references staff(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (encounter_prescription_id)
);

create index idx_dispensary_fulfillments_clinic_status on dispensary_fulfillments(clinic_id, status, created_at desc);
create index idx_dispensary_fulfillments_encounter on dispensary_fulfillments(encounter_id);
create index idx_dispensary_fulfillments_patient on dispensary_fulfillments(patient_id);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('receipt', 'dispense', 'adjustment', 'return')),
  quantity_change int not null check (quantity_change <> 0),
  quantity_after int not null check (quantity_after >= 0),
  reference_type text check (reference_type in ('fulfillment', 'manual')),
  reference_id uuid,
  reason text,
  recorded_by uuid references staff(id),
  recorded_at timestamptz not null default now()
);

create index idx_stock_movements_clinic_recorded on stock_movements(clinic_id, recorded_at desc);
create index idx_stock_movements_inventory on stock_movements(inventory_item_id, recorded_at desc);

alter table inventory_items enable row level security;
alter table dispensary_fulfillments enable row level security;
alter table stock_movements enable row level security;

create policy "inventory_items_clinic_isolation" on inventory_items
  for all using (clinic_id = get_user_clinic_id());

create policy "dispensary_fulfillments_clinic_isolation" on dispensary_fulfillments
  for all using (clinic_id = get_user_clinic_id());

create policy "stock_movements_clinic_isolation" on stock_movements
  for all using (clinic_id = get_user_clinic_id());
