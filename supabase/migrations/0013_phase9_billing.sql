-- Phase 9: Billing and invoicing

create table fee_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  code text not null,
  description text not null,
  category text not null check (category in ('consultation', 'procedure', 'medication', 'other')),
  unit_amount numeric(10, 2) not null check (unit_amount >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, code)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  encounter_id uuid references encounters(id) on delete set null,
  invoice_number int not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'partial', 'void')),
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  total numeric(10, 2) not null default 0 check (total >= 0),
  amount_paid numeric(10, 2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'MYR',
  notes text,
  issued_at timestamptz,
  issued_by uuid references staff(id),
  voided_at timestamptz,
  voided_by uuid references staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, invoice_number)
);

create unique index idx_invoices_active_encounter
  on invoices(encounter_id)
  where encounter_id is not null and status <> 'void';

create index idx_invoices_clinic_status on invoices(clinic_id, status);
create index idx_invoices_clinic_created on invoices(clinic_id, created_at desc);
create index idx_invoices_patient on invoices(patient_id);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  source_type text not null check (source_type in ('consultation', 'prescription', 'fee_catalog', 'manual')),
  source_id uuid,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_amount numeric(10, 2) not null check (unit_amount >= 0),
  line_total numeric(10, 2) not null check (line_total >= 0),
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index idx_invoice_line_items_invoice on invoice_line_items(invoice_id, sort_order);

create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  payment_method text not null check (payment_method in ('cash', 'card', 'bank_transfer', 'ewallet', 'other')),
  amount numeric(10, 2) not null check (amount > 0),
  reference text,
  notes text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references staff(id)
);

create index idx_invoice_payments_invoice on invoice_payments(invoice_id, recorded_at desc);
create index idx_fee_catalog_clinic_active on fee_catalog(clinic_id, is_active, sort_order);

create or replace function next_invoice_number(p_clinic_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(invoice_number), 0) + 1
  from invoices
  where clinic_id = p_clinic_id;
$$;

alter table fee_catalog enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table invoice_payments enable row level security;

create policy "fee_catalog_clinic_isolation" on fee_catalog
  for all using (clinic_id = get_user_clinic_id());

create policy "invoices_clinic_isolation" on invoices
  for all using (clinic_id = get_user_clinic_id());

create policy "invoice_line_items_isolation" on invoice_line_items
  for all using (
    exists (
      select 1
      from invoices
      where invoices.id = invoice_line_items.invoice_id
        and invoices.clinic_id = get_user_clinic_id()
    )
  );

create policy "invoice_payments_isolation" on invoice_payments
  for all using (
    exists (
      select 1
      from invoices
      where invoices.id = invoice_payments.invoice_id
        and invoices.clinic_id = get_user_clinic_id()
    )
  );
