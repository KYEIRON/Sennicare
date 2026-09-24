-- =============================================================================
-- BOYD'S Logistics LLC — 0005 configurable reference data
--
-- Industries, job types and service areas are ROWS, not code. Adding one is a
-- database insert rather than a deployment, and North Carolina is never
-- hardcoded. See docs/DECISIONS.md D-008.
-- =============================================================================

create table industries (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint industries_code_shape check (code ~ '^[A-Z0-9_]+$')
);

create trigger industries_set_updated_at
  before update on industries
  for each row execute function set_updated_at();

create table job_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint job_types_code_shape check (code ~ '^[A-Z0-9_]+$')
);

comment on table job_types is
  'Configurable job types. New BOYD''S services are added as rows, never as code.';

create trigger job_types_set_updated_at
  before update on job_types
  for each row execute function set_updated_at();

create table service_areas (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  country       text not null default 'US',
  state         text,
  metro         text,
  counties      text[] not null default '{}',
  zip_prefixes  text[] not null default '{}',
  active        boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint service_areas_state_shape check (state is null or state ~ '^[A-Z]{2}$')
);

comment on table service_areas is
  'Where BOYD''S operates. North Carolina is a ROW here, never a constant. Expanding to another state costs an insert, not a release. The detailed radius and county list is NOT CONFIGURED until the partners decide.';

create trigger service_areas_set_updated_at
  before update on service_areas
  for each row execute function set_updated_at();

-- --- Reference values --------------------------------------------------------
-- These are classification vocabulary, not BOYD'S business data. Nothing here
-- is an invented customer, price, vehicle specification or address.

insert into industries (code, name, sort_order) values
  ('HEALTHCARE',       'Healthcare',       10),
  ('MEDICAL',          'Medical',          20),
  ('MANUFACTURING',    'Manufacturing',    30),
  ('AUTOMOTIVE',       'Automotive',       40),
  ('CONSTRUCTION',     'Construction',     50),
  ('DISTRIBUTION',     'Distribution',     60),
  ('WHOLESALE',        'Wholesale',        70),
  ('RETAIL',           'Retail',           80),
  ('ECOMMERCE',        'E-commerce',       90),
  ('GENERAL_BUSINESS', 'General Business', 100),
  ('OTHER',            'Other',            110);

insert into job_types (code, name, sort_order) values
  ('SAME_DAY',            'Same Day',            10),
  ('URGENT',              'Urgent',              20),
  ('DEDICATED_VAN',       'Dedicated Van',       30),
  ('MEDICAL_COURIER',     'Medical Courier',     40),
  ('GENERAL_GOODS',       'General Goods',       50),
  ('DISTRIBUTION',        'Distribution',        60),
  ('SUPPLY',              'Supply',              70),
  ('INDUSTRIAL_PARTS',    'Industrial Parts',    80),
  ('SCHEDULED_DELIVERY',  'Scheduled Delivery',  90),
  ('OTHER',               'Other',               100);

-- BOYD'S initial operating state. The radius, counties and metros within it are
-- deliberately left empty: those are business decisions the partners have not
-- made, and NOT CONFIGURED is the honest representation of that.
insert into service_areas (name, country, state, sort_order) values
  ('North Carolina', 'US', 'NC', 10);
