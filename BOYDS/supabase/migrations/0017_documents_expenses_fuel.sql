-- =============================================================================
-- BOYD'S Logistics LLC — 0017 documents, expenses and fuel
--
-- The records the driver creates in the field: proof of delivery, photos,
-- receipts, fuel purchases and expenses.
--
-- Storage is private. Files are never publicly readable; the application issues
-- short-lived signed URLs after an authorisation check.
-- =============================================================================

create type document_type as enum (
  'POD', 'SIGNATURE', 'PICKUP_PHOTO', 'DELIVERY_PHOTO', 'RECEIPT',
  'VEHICLE', 'INSURANCE', 'MAINTENANCE', 'COMPLIANCE', 'CUSTOMER', 'OTHER'
);

create type expense_category as enum (
  'FUEL', 'TOLL', 'PARKING', 'DRIVER', 'MAINTENANCE', 'SUPPLIES', 'OTHER'
);

-- --- documents ---------------------------------------------------------------

create table documents (
  id             uuid primary key default gen_random_uuid(),
  document_type  document_type not null,
  entity_table   text not null,
  entity_id      uuid not null,
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null,
  caption        text,
  -- For a signature: who signed, as they gave their name. Never inferred.
  signed_by_name text,
  captured_at    timestamptz not null default now(),
  uploaded_by    uuid references users (id) on delete set null,
  created_at     timestamptz not null default now(),

  constraint documents_size_sane check (size_bytes > 0 and size_bytes <= 26214400),
  constraint documents_entity_known
    check (entity_table in ('jobs', 'job_stops', 'vehicles', 'customers', 'job_expenses'))
);

comment on table documents is
  'Metadata for files in private storage. The file itself is never publicly readable — the application issues a short-lived signed URL after checking the caller may see it.';

create index documents_entity_idx on documents (entity_table, entity_id, created_at desc);
create index documents_type_idx on documents (document_type);

-- --- job expenses ------------------------------------------------------------

create table job_expenses (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references jobs (id) on delete restrict,
  vehicle_id          uuid references vehicles (id) on delete restrict,
  driver_id           uuid references drivers (id) on delete restrict,
  category            expense_category not null,
  description         text,
  amount_cents        bigint not null,
  incurred_at         timestamptz not null default now(),
  receipt_document_id uuid references documents (id) on delete set null,
  recorded_by         uuid references users (id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint job_expenses_amount_positive check (amount_cents > 0)
);

comment on table job_expenses is
  'Individual expenses recorded in the field. These ROLL UP into the job cost columns; they do not replace them, so a job keeps both the detail and the total.';

create index job_expenses_job_idx on job_expenses (job_id) where job_id is not null;
create index job_expenses_driver_idx on job_expenses (driver_id, incurred_at desc);

create trigger job_expenses_set_updated_at
  before update on job_expenses
  for each row execute function set_updated_at();

-- --- fuel transactions -------------------------------------------------------

create table fuel_transactions (
  id                      uuid primary key default gen_random_uuid(),
  vehicle_id              uuid not null references vehicles (id) on delete restrict,
  driver_id               uuid references drivers (id) on delete set null,
  job_id                  uuid references jobs (id) on delete set null,
  gallons_thousandths     integer not null,
  price_per_gallon_cents  integer not null,
  total_cost_cents        bigint not null,
  odometer_tenths         integer,
  station                 text,
  purchased_at            timestamptz not null default now(),
  receipt_document_id     uuid references documents (id) on delete set null,
  recorded_by             uuid references users (id) on delete set null,
  created_at              timestamptz not null default now(),

  constraint fuel_gallons_positive check (gallons_thousandths > 0),
  constraint fuel_price_positive check (price_per_gallon_cents > 0),
  constraint fuel_total_positive check (total_cost_cents > 0)
);

comment on column fuel_transactions.total_cost_cents is
  'The amount actually paid, as printed on the receipt — NOT gallons times price. Pumps round, and the receipt is the fact.';

create index fuel_transactions_vehicle_idx on fuel_transactions (vehicle_id, purchased_at desc);
create index fuel_transactions_job_idx on fuel_transactions (job_id) where job_id is not null;

-- --- Expenses roll up into the job's actual costs ----------------------------
--
-- A job's cost columns are the total; the expense rows are the detail. The
-- rollup is a trigger so the two can never disagree, and so recording a receipt
-- in the field immediately makes the job's contribution more complete.

create or replace function rollup_job_expenses()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  target_job uuid := coalesce(new.job_id, old.job_id);
begin
  if target_job is null then
    return null;
  end if;

  update jobs j
  set fuel_cost_actual_cents    = totals.fuel,
      toll_cost_actual_cents    = totals.toll,
      parking_cost_actual_cents = totals.parking,
      other_cost_actual_cents   = totals.other
  from (
    select
      nullif(sum(amount_cents) filter (where category = 'FUEL'), 0)    as fuel,
      nullif(sum(amount_cents) filter (where category = 'TOLL'), 0)    as toll,
      nullif(sum(amount_cents) filter (where category = 'PARKING'), 0) as parking,
      nullif(sum(amount_cents) filter (where category in ('SUPPLIES', 'OTHER', 'MAINTENANCE')), 0) as other
    from job_expenses
    where job_id = target_job
  ) totals
  where j.id = target_job;

  return null;
end;
$$;

comment on function rollup_job_expenses is
  'Keeps a job''s actual cost columns equal to the sum of its expense rows. NULLIF leaves a category with no expenses as NULL — MISSING, not zero, because no receipt recorded is not the same as no cost incurred.';

create trigger job_expenses_rollup
  after insert or update or delete on job_expenses
  for each row execute function rollup_job_expenses();

-- Recording fuel also creates the matching expense, so a driver enters it once.
create or replace function fuel_transaction_to_expense()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.job_id is not null then
    insert into job_expenses (
      job_id, vehicle_id, driver_id, category, description,
      amount_cents, incurred_at, receipt_document_id, recorded_by
    )
    values (
      new.job_id, new.vehicle_id, new.driver_id, 'FUEL',
      coalesce(new.station, 'Fuel'),
      new.total_cost_cents, new.purchased_at, new.receipt_document_id, new.recorded_by
    );
  end if;

  -- The odometer reading at the pump is real mileage data; keep the vehicle
  -- current, but never let it run backwards.
  if new.odometer_tenths is not null then
    update vehicles
    set current_odometer_tenths = new.odometer_tenths
    where id = new.vehicle_id
      and (current_odometer_tenths is null or current_odometer_tenths < new.odometer_tenths);
  end if;

  return null;
end;
$$;

create trigger fuel_transactions_create_expense
  after insert on fuel_transactions
  for each row execute function fuel_transaction_to_expense();

-- --- Proof of delivery is required before POD_RECEIVED -----------------------

create or replace function enforce_pod_before_pod_received()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'POD_RECEIVED' and old.status is distinct from 'POD_RECEIVED' then
    if not exists (
      select 1 from documents
      where entity_table = 'jobs'
        and entity_id = new.id
        and document_type in ('POD', 'SIGNATURE', 'DELIVERY_PHOTO')
    ) then
      raise exception
        'POD_RECEIVED requires proof of delivery on the job — a signature, a photo, or an uploaded document.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger jobs_enforce_pod
  before update on jobs
  for each row execute function enforce_pod_before_pod_received();

-- --- Row level security ------------------------------------------------------

alter table documents enable row level security;
alter table job_expenses enable row level security;
alter table fuel_transactions enable row level security;
alter table documents force row level security;
alter table job_expenses force row level security;
alter table fuel_transactions force row level security;

create policy documents_partner on documents
  for all using (is_partner()) with check (is_partner());

-- A driver sees and adds documents for their OWN jobs only.
create policy documents_driver_own_job on documents
  for select using (
    is_driver() and entity_table = 'jobs' and entity_id in (
      select j.id from jobs j
      join drivers d on d.id = j.driver_id
      where d.user_id = current_app_user_id()
    )
  );

create policy documents_driver_insert on documents
  for insert with check (
    is_driver() and entity_table in ('jobs', 'job_expenses') and (
      entity_table = 'job_expenses' or entity_id in (
        select j.id from jobs j
        join drivers d on d.id = j.driver_id
        where d.user_id = current_app_user_id()
      )
    )
  );

create policy job_expenses_partner on job_expenses
  for all using (is_partner()) with check (is_partner());

create policy job_expenses_driver_own on job_expenses
  for select using (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

create policy job_expenses_driver_insert on job_expenses
  for insert with check (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

create policy fuel_partner on fuel_transactions
  for all using (is_partner()) with check (is_partner());

create policy fuel_driver_own on fuel_transactions
  for select using (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

create policy fuel_driver_insert on fuel_transactions
  for insert with check (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

revoke all on documents, job_expenses, fuel_transactions from anon, authenticated;
grant select, insert, update, delete on documents, job_expenses, fuel_transactions
  to authenticated;

-- A driver may not edit or delete a record once it is filed. Corrections are a
-- partner action, and they leave the original in the audit trail.
create or replace function enforce_driver_record_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if is_driver() then
    raise exception 'A recorded expense or fuel purchase can only be corrected by a partner.'
      using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger job_expenses_driver_immutable
  before update or delete on job_expenses
  for each row execute function enforce_driver_record_immutability();

create trigger fuel_transactions_driver_immutable
  before update or delete on fuel_transactions
  for each row execute function enforce_driver_record_immutability();

-- Audit the new tables too.
create trigger job_expenses_audit
  after insert or update on job_expenses
  for each row execute function write_audit_log();
