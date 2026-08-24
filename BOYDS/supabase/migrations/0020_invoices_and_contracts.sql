-- =============================================================================
-- BOYD'S Logistics LLC — 0020 invoices, payments and contracts
--
-- AN INVOICE IS PAID ONLY WHEN PAYMENTS COVER IT.
--
-- There is no way to mark an invoice paid by hand. The status is derived from
-- the payment rows, so "paid" always means money BOYD'S can point at. Claiming
-- otherwise would corrupt the one figure a small business cannot afford to be
-- wrong about: what it is actually owed.
-- =============================================================================

create type invoice_status as enum ('DRAFT', 'SENT', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED');

create type contract_status as enum ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

create type payment_method as enum ('BANK_TRANSFER', 'CHECK', 'CARD', 'CASH', 'OTHER');

-- --- Contracts ---------------------------------------------------------------

create table contracts (
  id                uuid primary key default gen_random_uuid(),
  contract_number   text not null unique,
  customer_id       uuid not null references customers (id) on delete restrict,
  title             text not null,
  status            contract_status not null default 'DRAFT',

  start_date        date,
  end_date          date,
  frequency         text,
  routes            jsonb not null default '[]'::jsonb,

  agreed_rate_cents bigint,
  rate_basis        text,
  minimum_volume    integer,

  payment_terms_days integer,
  terms             text,
  notes             text,
  provenance        data_provenance not null default 'REAL',

  created_by        uuid references users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint contracts_dates_sane check (end_date is null or start_date is null or end_date >= start_date),
  constraint contracts_rate_non_negative check (agreed_rate_cents is null or agreed_rate_cents >= 0),
  constraint contracts_active_has_start check (status <> 'ACTIVE' or start_date is not null)
);

comment on table contracts is
  'Recurring work agreements. agreed_rate_cents is NULL until a rate is actually agreed — an unpriced contract is not a free one.';

create index contracts_customer_idx on contracts (customer_id);
create index contracts_active_idx on contracts (status) where status = 'ACTIVE';

create trigger contracts_set_updated_at
  before update on contracts
  for each row execute function set_updated_at();

-- Jobs can belong to a contract.
alter table jobs add column contract_id uuid references contracts (id) on delete set null;
create index jobs_contract_idx on jobs (contract_id) where contract_id is not null;

-- --- Invoices ----------------------------------------------------------------

create table invoices (
  id                 uuid primary key default gen_random_uuid(),
  invoice_number     text not null unique,
  customer_id        uuid not null references customers (id) on delete restrict,
  contract_id        uuid references contracts (id) on delete set null,

  status             invoice_status not null default 'DRAFT',
  issue_date         date,
  due_date           date,

  subtotal_cents     bigint not null default 0,
  tax_cents          bigint not null default 0,
  total_cents        bigint not null default 0,

  -- Derived from the payments table by trigger. Never set by hand.
  amount_paid_cents  bigint not null default 0,

  sent_at            timestamptz,
  paid_at            timestamptz,
  cancelled_at       timestamptz,
  cancellation_reason text,

  notes              text,
  provenance         data_provenance not null default 'REAL',

  created_by         uuid references users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint invoices_amounts_non_negative check (
    subtotal_cents >= 0 and tax_cents >= 0 and total_cents >= 0 and amount_paid_cents >= 0
  ),
  constraint invoices_sent_has_dates check (
    status in ('DRAFT', 'CANCELLED') or (issue_date is not null and due_date is not null)
  ),
  constraint invoices_due_after_issue check (
    due_date is null or issue_date is null or due_date >= issue_date
  ),
  constraint invoices_cancelled_has_reason check (
    status <> 'CANCELLED' or length(btrim(coalesce(cancellation_reason, ''))) > 0
  )
);

comment on column invoices.amount_paid_cents is
  'Derived from the payments table by trigger. There is no code path that sets this directly, so it can never claim money BOYD''S did not receive.';

create index invoices_status_idx on invoices (status);
create index invoices_customer_idx on invoices (customer_id);
create index invoices_outstanding_idx on invoices (due_date)
  where status in ('SENT', 'DUE', 'OVERDUE');

create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

create table invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references invoices (id) on delete cascade,
  job_id           uuid references jobs (id) on delete restrict,
  sequence         integer not null,
  description      text not null,
  quantity         numeric(10, 2) not null default 1,
  unit_price_cents bigint not null,
  total_cents      bigint not null,

  unique (invoice_id, sequence),
  constraint invoice_lines_amounts_non_negative
    check (unit_price_cents >= 0 and total_cents >= 0)
);

create index invoice_lines_job_idx on invoice_lines (job_id) where job_id is not null;

-- --- Payments ----------------------------------------------------------------

create table payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices (id) on delete restrict,
  amount_cents bigint not null,
  received_at  date not null default current_date,
  method       payment_method not null,
  reference    text,
  notes        text,
  recorded_by  uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint payments_amount_positive check (amount_cents > 0)
);

comment on table payments is
  'Money BOYD''S actually received. An invoice reaches PAID only when these rows cover its total — there is no other route.';

create index payments_invoice_idx on payments (invoice_id, received_at);

-- --- The invoice total follows its lines -------------------------------------

create or replace function recalculate_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update invoices i
  set subtotal_cents = coalesce(totals.subtotal, 0),
      total_cents    = coalesce(totals.subtotal, 0) + i.tax_cents
  from (
    select sum(total_cents) as subtotal from invoice_lines where invoice_id = target
  ) totals
  where i.id = target;

  return null;
end;
$$;

create trigger invoice_lines_recalculate
  after insert or update or delete on invoice_lines
  for each row execute function recalculate_invoice_total();

-- --- Payment status is derived, never asserted -------------------------------

create or replace function recalculate_invoice_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
  paid bigint;
  invoice invoices;
begin
  select coalesce(sum(amount_cents), 0) into paid from payments where invoice_id = target;
  select * into invoice from invoices where id = target;

  update invoices
  set amount_paid_cents = paid,
      status = case
        when status = 'CANCELLED' then status
        when paid >= invoice.total_cents and invoice.total_cents > 0 then 'PAID'::invoice_status
        when status = 'PAID' then
          -- A payment was reversed. The invoice is owed again; recompute from
          -- the due date rather than leaving it claiming to be settled.
          case
            when invoice.due_date is not null and invoice.due_date < current_date
              then 'OVERDUE'::invoice_status
            else 'DUE'::invoice_status
          end
        else status
      end,
      paid_at = case
        when paid >= invoice.total_cents and invoice.total_cents > 0
          then coalesce(invoice.paid_at, now())
        else null
      end
  where id = target;

  return null;
end;
$$;

comment on function recalculate_invoice_payment is
  'Derives amount_paid and the PAID status from real payment rows. Reversing a payment returns the invoice to DUE or OVERDUE rather than leaving it claiming to be settled.';

create trigger payments_recalculate_invoice
  after insert or update or delete on payments
  for each row execute function recalculate_invoice_payment();

-- --- PAID cannot be claimed by hand -----------------------------------------

create or replace function enforce_invoice_payment_truth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- amount_paid_cents is derived. A caller cannot set it.
  if new.amount_paid_cents is distinct from old.amount_paid_cents
     and coalesce(current_setting('boyds.recalculating_payment', true), '') <> 'on'
  then
    raise exception
      'Amount paid is derived from recorded payments. Record a payment instead of setting it.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status = 'PAID' and old.status is distinct from 'PAID' then
    if coalesce(current_setting('boyds.recalculating_payment', true), '') <> 'on' then
      raise exception
        'An invoice becomes PAID when recorded payments cover its total. Record the payment instead.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'SENT' and old.status is distinct from 'SENT' then
    new.sent_at := coalesce(new.sent_at, now());
  end if;

  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  return new;
end;
$$;

create trigger invoices_enforce_payment_truth
  before update on invoices
  for each row execute function enforce_invoice_payment_truth();

-- The recalculation trigger is the one sanctioned writer of those columns.
create or replace function recalculate_invoice_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
  paid bigint;
  invoice invoices;
begin
  select coalesce(sum(amount_cents), 0) into paid from payments where invoice_id = target;
  select * into invoice from invoices where id = target;

  perform set_config('boyds.recalculating_payment', 'on', true);

  update invoices
  set amount_paid_cents = paid,
      status = case
        when status = 'CANCELLED' then status
        when paid >= invoice.total_cents and invoice.total_cents > 0 then 'PAID'::invoice_status
        when status = 'PAID' then
          case
            when invoice.due_date is not null and invoice.due_date < current_date
              then 'OVERDUE'::invoice_status
            else 'DUE'::invoice_status
          end
        else status
      end,
      paid_at = case
        when paid >= invoice.total_cents and invoice.total_cents > 0
          then coalesce(invoice.paid_at, now())
        else null
      end
  where id = target;

  perform set_config('boyds.recalculating_payment', 'off', true);

  return null;
end;
$$;

-- --- Row level security ------------------------------------------------------
-- Money. Partners only.

alter table contracts enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payments enable row level security;
alter table contracts force row level security;
alter table invoices force row level security;
alter table invoice_lines force row level security;
alter table payments force row level security;

create policy contracts_partner on contracts
  for all using (is_partner()) with check (is_partner());
create policy invoices_partner on invoices
  for all using (is_partner()) with check (is_partner());
create policy invoice_lines_partner on invoice_lines
  for all using (is_partner()) with check (is_partner());
create policy payments_partner on payments
  for all using (is_partner()) with check (is_partner());

revoke all on contracts, invoices, invoice_lines, payments from anon, authenticated;
grant select, insert, update, delete on contracts, invoices, invoice_lines, payments
  to authenticated;

create trigger invoices_audit
  after insert or update on invoices
  for each row execute function write_audit_log();
create trigger contracts_audit
  after insert or update on contracts
  for each row execute function write_audit_log();
