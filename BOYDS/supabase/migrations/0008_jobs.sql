-- =============================================================================
-- BOYD'S Logistics LLC — 0008 jobs, stops and mileage
--
-- ESTIMATE AND ACTUAL ARE NEVER MIXED.
-- Every cost is three columns: _estimated_cents, _actual_cents, and a _state
-- derived by trigger. An estimate never silently becomes an actual, and a
-- missing cost is MISSING — never zero. A missing cost treated as zero would
-- overstate contribution, which is the exact failure BOYD'S exists to avoid.
--
-- CONTRIBUTION IS NOT STORED. It is derived, so a stored total can never drift
-- out of agreement with the costs beneath it. See docs/DECISIONS.md D-005.
-- =============================================================================

create table jobs (
  id                       uuid primary key default gen_random_uuid(),
  job_number               text not null unique,

  -- Commercial
  customer_id              uuid not null references customers (id) on delete restrict,
  customer_contact_id      uuid references customer_contacts (id) on delete set null,
  job_type_id              uuid not null references job_types (id) on delete restrict,
  priority                 job_priority not null default 'STANDARD',
  status                   job_status not null default 'REQUESTED',

  -- Shipment
  description              text,
  quantity                 integer,
  weight_lbs               numeric(10, 2),
  dimensions               text,
  pallets                  integer,
  special_handling         text,

  -- Scheduling
  requested_at             timestamptz,
  scheduled_date           date,
  scheduled_time           time,
  scheduled_window_end     time,

  -- Dispatch
  vehicle_id               uuid references vehicles (id) on delete restrict,
  driver_id                uuid references drivers (id) on delete restrict,
  assigned_at              timestamptz,
  assigned_by              uuid references users (id) on delete set null,
  driver_accepted_at       timestamptz,

  -- Execution timestamps
  started_at               timestamptz,
  picked_up_at             timestamptz,
  delivered_at             timestamptz,
  completed_at             timestamptz,

  -- Mileage: estimated and actual kept apart, loaded and empty kept apart.
  estimated_miles_tenths   integer,
  actual_miles_tenths      integer,
  loaded_miles_tenths      integer,
  empty_miles_tenths       integer,
  start_odometer_tenths    integer,
  pickup_odometer_tenths   integer,
  delivery_odometer_tenths integer,
  end_odometer_tenths      integer,

  -- Revenue
  quoted_price_cents       bigint,
  won_price_cents          bigint,

  -- Costs. Three columns each; the state column is maintained by trigger.
  fuel_cost_estimated_cents      bigint,
  fuel_cost_actual_cents         bigint,
  fuel_cost_state                cost_state not null default 'MISSING',

  driver_cost_estimated_cents    bigint,
  driver_cost_actual_cents       bigint,
  driver_cost_state              cost_state not null default 'MISSING',

  vehicle_cost_estimated_cents   bigint,
  vehicle_cost_actual_cents      bigint,
  vehicle_cost_state             cost_state not null default 'MISSING',

  toll_cost_estimated_cents      bigint,
  toll_cost_actual_cents         bigint,
  toll_cost_state                cost_state not null default 'MISSING',

  parking_cost_estimated_cents   bigint,
  parking_cost_actual_cents      bigint,
  parking_cost_state             cost_state not null default 'MISSING',

  other_cost_estimated_cents     bigint,
  other_cost_actual_cents        bigint,
  other_cost_state               cost_state not null default 'MISSING',

  -- Provenance and housekeeping
  source                   request_source not null default 'PARTNER',
  is_after_hours           boolean not null default false,
  requires_review          boolean not null default false,
  review_reason            text,
  notes                    text,
  internal_notes           text,
  provenance               data_provenance not null default 'REAL',

  cancelled_at             timestamptz,
  cancellation_reason      text,
  created_by               uuid references users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint jobs_mileage_non_negative check (
    coalesce(estimated_miles_tenths, 0) >= 0
    and coalesce(actual_miles_tenths, 0) >= 0
    and coalesce(loaded_miles_tenths, 0) >= 0
    and coalesce(empty_miles_tenths, 0) >= 0
  ),
  -- Business rule 21: total = loaded + empty. Enforced whenever all three exist.
  constraint jobs_mileage_split_consistent check (
    actual_miles_tenths is null
    or loaded_miles_tenths is null
    or empty_miles_tenths is null
    or actual_miles_tenths = loaded_miles_tenths + empty_miles_tenths
  ),
  constraint jobs_prices_non_negative check (
    coalesce(quoted_price_cents, 0) >= 0 and coalesce(won_price_cents, 0) >= 0
  ),
  constraint jobs_cancellation_has_reason check (
    cancelled_at is null or length(btrim(coalesce(cancellation_reason, ''))) > 0
  )
);

comment on table jobs is
  'The central operational object. Contribution is deliberately NOT stored: it is derived from these columns so a total can never disagree with its inputs.';
comment on column jobs.empty_miles_tenths is
  'Deadhead miles — driven without a load. Not all miles are revenue miles, and BOYD''S treats empty mileage as a strategic metric.';

create index jobs_status_idx on jobs (status);
create index jobs_customer_idx on jobs (customer_id);
create index jobs_scheduled_idx on jobs (scheduled_date, scheduled_time);
create index jobs_driver_idx on jobs (driver_id) where driver_id is not null;
create index jobs_vehicle_idx on jobs (vehicle_id) where vehicle_id is not null;
create index jobs_unassigned_idx on jobs (scheduled_date)
  where driver_id is null or vehicle_id is null;

create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- --- Cost state is derived, never asserted -----------------------------------

create or replace function derive_job_cost_states()
returns trigger
language plpgsql
as $$
begin
  new.fuel_cost_state := case
    when new.fuel_cost_actual_cents is not null then 'ACTUAL'
    when new.fuel_cost_estimated_cents is not null then 'ESTIMATED'
    else 'MISSING' end;

  new.driver_cost_state := case
    when new.driver_cost_actual_cents is not null then 'ACTUAL'
    when new.driver_cost_estimated_cents is not null then 'ESTIMATED'
    else 'MISSING' end;

  new.vehicle_cost_state := case
    when new.vehicle_cost_actual_cents is not null then 'ACTUAL'
    when new.vehicle_cost_estimated_cents is not null then 'ESTIMATED'
    else 'MISSING' end;

  new.toll_cost_state := case
    when new.toll_cost_actual_cents is not null then 'ACTUAL'
    when new.toll_cost_estimated_cents is not null then 'ESTIMATED'
    else 'MISSING' end;

  new.parking_cost_state := case
    when new.parking_cost_actual_cents is not null then 'ACTUAL'
    when new.parking_cost_estimated_cents is not null then 'ESTIMATED'
    else 'MISSING' end;

  new.other_cost_state := case
    when new.other_cost_actual_cents is not null then 'ACTUAL'
    when new.other_cost_estimated_cents is not null then 'ESTIMATED'
    else 'MISSING' end;

  return new;
end;
$$;

comment on function derive_job_cost_states is
  'Cost state is computed from the data, never supplied by a caller, so the flag cannot disagree with the columns it describes.';

create trigger jobs_derive_cost_states
  before insert or update on jobs
  for each row execute function derive_job_cost_states();

-- --- Job stops: multi-stop from the start ------------------------------------
-- BOYD'S runs simple pickup-to-delivery work today. The model is already
-- pickup -> pickup -> delivery -> delivery capable, so the second stop costs a
-- row rather than a migration and a rewrite.

create table job_stops (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs (id) on delete cascade,
  sequence          integer not null,
  stop_type         stop_type not null,
  status            stop_status not null default 'PENDING',

  customer_location_id uuid references customer_locations (id) on delete set null,
  address_line1     text not null,
  address_line2     text,
  city              text not null,
  state             text not null,
  zip               text not null,
  latitude          numeric(9, 6),
  longitude         numeric(9, 6),

  contact_name      text,
  contact_phone     text,
  instructions      text,

  scheduled_date    date,
  scheduled_time    time,
  window_end        time,
  actual_arrival    timestamptz,
  actual_departure  timestamptz,
  odometer_tenths   integer,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint job_stops_sequence_positive check (sequence > 0),
  constraint job_stops_state_shape check (state ~ '^[A-Z]{2}$'),
  constraint job_stops_zip_shape check (zip ~ '^\d{5}(-\d{4})?$'),
  constraint job_stops_departure_after_arrival check (
    actual_departure is null or actual_arrival is null or actual_departure >= actual_arrival
  ),
  unique (job_id, sequence)
);

create index job_stops_job_idx on job_stops (job_id, sequence);

create trigger job_stops_set_updated_at
  before update on job_stops
  for each row execute function set_updated_at();

-- --- Mileage logs ------------------------------------------------------------

create table mileage_logs (
  id                     uuid primary key default gen_random_uuid(),
  job_id                 uuid references jobs (id) on delete set null,
  vehicle_id             uuid not null references vehicles (id) on delete restrict,
  driver_id              uuid references drivers (id) on delete set null,
  mileage_type           mileage_type not null,
  start_odometer_tenths  integer not null,
  end_odometer_tenths    integer not null,
  miles_tenths           integer generated always as
                           (end_odometer_tenths - start_odometer_tenths) stored,
  logged_at              timestamptz not null default now(),
  notes                  text,
  recorded_by            uuid references users (id) on delete set null,
  created_at             timestamptz not null default now(),

  -- Business rule 22: an odometer never runs backwards.
  constraint mileage_logs_odometer_not_decreasing
    check (end_odometer_tenths >= start_odometer_tenths)
);

comment on column mileage_logs.mileage_type is
  'LOADED, EMPTY or PERSONAL_EXCLUDED. Personal mileage never enters business cost or contribution.';

create index mileage_logs_job_idx on mileage_logs (job_id) where job_id is not null;
create index mileage_logs_vehicle_idx on mileage_logs (vehicle_id, logged_at desc);
