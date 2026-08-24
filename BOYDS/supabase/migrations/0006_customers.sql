-- =============================================================================
-- BOYD'S Logistics LLC — 0006 customers, contacts and locations
--
-- No customer data is seeded. BOYD'S has real customers or it has none; the
-- software does not invent any.
-- =============================================================================

create table customers (
  id                 uuid primary key default gen_random_uuid(),
  customer_number    text not null unique,
  company_name       text not null,
  customer_type      customer_type not null default 'BUSINESS',
  industry_id        uuid references industries (id) on delete set null,
  customer_status    customer_status not null default 'PROSPECT',

  -- Denormalised primary contact for fast list rendering. The authoritative
  -- contacts live in customer_contacts; this is kept in step by trigger.
  primary_contact_name  text,
  primary_contact_email citext,
  primary_contact_phone text,

  payment_terms_days integer,
  lead_source        text,
  notes              text,

  -- Illustrative records for interface work are marked in the database, so no
  -- code path can present one as a real BOYD'S customer.
  provenance         data_provenance not null default 'REAL',

  last_activity_at   timestamptz,
  created_by         uuid references users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint customers_company_name_present check (length(btrim(company_name)) > 0),
  constraint customers_payment_terms_sane
    check (payment_terms_days is null or payment_terms_days between 0 and 180)
);

comment on column customers.payment_terms_days is
  'NULL means NOT CONFIGURED. BOYD''S standard payment terms are an open business decision; no default is invented.';
comment on column customers.provenance is
  'REAL or DEMO. Illustrative records are marked here so they cannot be mistaken for real operational data.';

create index customers_status_idx on customers (customer_status) where deleted_at is null;
create index customers_company_name_idx on customers (lower(company_name)) where deleted_at is null;
create index customers_provenance_idx on customers (provenance) where provenance = 'DEMO';

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- --- Contacts: several people per customer -----------------------------------

create table customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers (id) on delete cascade,
  role         contact_role not null default 'PRIMARY',
  name         text not null,
  job_title    text,
  email        citext,
  phone        text,
  is_primary   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint customer_contacts_name_present check (length(btrim(name)) > 0)
);

-- At most one primary contact per customer, enforced by the database.
create unique index customer_contacts_one_primary
  on customer_contacts (customer_id) where is_primary;

create index customer_contacts_customer_idx on customer_contacts (customer_id);

create trigger customer_contacts_set_updated_at
  before update on customer_contacts
  for each row execute function set_updated_at();

-- --- Locations: billing, service and reusable delivery addresses -------------

create table customer_locations (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers (id) on delete cascade,
  kind          location_kind not null default 'SERVICE',
  label         text,
  address_line1 text not null,
  address_line2 text,
  city          text not null,
  state         text not null,
  zip           text not null,
  country       text not null default 'US',
  latitude      numeric(9, 6),
  longitude     numeric(9, 6),
  contact_name  text,
  contact_phone text,
  instructions  text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint customer_locations_state_shape check (state ~ '^[A-Z]{2}$'),
  constraint customer_locations_zip_shape check (zip ~ '^\d{5}(-\d{4})?$')
);

comment on table customer_locations is
  'Reusable addresses. A customer''s regular pickup and delivery points are recorded once and referenced by jobs, which is the foundation of repeat-work and recurring-route analysis.';

create index customer_locations_customer_idx on customer_locations (customer_id);

create trigger customer_locations_set_updated_at
  before update on customer_locations
  for each row execute function set_updated_at();

-- --- Communications and notes: the customer history foundation ---------------

create table customer_notes (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers (id) on delete cascade,
  body         text not null,
  is_pinned    boolean not null default false,
  created_by   uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint customer_notes_body_present check (length(btrim(body)) > 0)
);

create index customer_notes_customer_idx on customer_notes (customer_id, created_at desc);

-- --- Keeping the denormalised primary contact honest -------------------------

create or replace function sync_customer_primary_contact()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  target_customer uuid := coalesce(new.customer_id, old.customer_id);
begin
  update customers c
  set primary_contact_name  = pc.name,
      primary_contact_email = pc.email,
      primary_contact_phone = pc.phone
  from (
    select name, email, phone
    from customer_contacts
    where customer_id = target_customer and is_primary
    limit 1
  ) pc
  where c.id = target_customer;

  -- No primary contact remains: clear the cached values rather than leaving
  -- stale details that look current.
  if not found then
    update customers
    set primary_contact_name = null,
        primary_contact_email = null,
        primary_contact_phone = null
    where id = target_customer;
  end if;

  return null;
end;
$$;

create trigger customer_contacts_sync_primary
  after insert or update or delete on customer_contacts
  for each row execute function sync_customer_primary_contact();
