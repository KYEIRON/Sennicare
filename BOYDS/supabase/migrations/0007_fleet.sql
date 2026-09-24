-- =============================================================================
-- BOYD'S Logistics LLC — 0007 fleet and drivers
--
-- BOYD'S operates one van today. Nothing here assumes that: every relationship
-- is many-vehicles, many-drivers, and adding the second van is an insert.
--
-- NO VEHICLE SPECIFICATION IS INVENTED. VIN, plate, make, model, year, purchase
-- price and insurance details are all nullable and stay NULL until BOYD'S
-- supplies the real documents. A null here means NOT CONFIGURED, not zero.
-- =============================================================================

create table vehicles (
  id                        uuid primary key default gen_random_uuid(),
  vehicle_code              text not null unique,

  -- Identity — all nullable, all NOT CONFIGURED until supplied from documents.
  license_plate             text,
  license_state             text,
  vin                       text,
  make                      text,
  model                     text,
  year                      integer,
  vehicle_type              vehicle_type,

  -- Acquisition
  purchase_date             date,
  purchase_price_cents      bigint,

  -- Operation
  current_odometer_tenths   integer,
  fuel_economy_mpg_tenths   integer,
  status                    vehicle_status not null default 'AVAILABLE',

  -- Insurance
  insurance_provider        text,
  insurance_policy_number   text,
  insurance_renewal_date    date,
  insurance_cost_cents      bigint,

  notes                     text,
  active                    boolean not null default true,
  provenance                data_provenance not null default 'REAL',

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint vehicles_code_shape check (vehicle_code ~ '^[A-Z0-9-]+$'),
  constraint vehicles_state_shape check (license_state is null or license_state ~ '^[A-Z]{2}$'),
  constraint vehicles_vin_shape check (vin is null or length(vin) = 17),
  constraint vehicles_year_sane check (year is null or year between 1980 and 2100),
  constraint vehicles_odometer_non_negative
    check (current_odometer_tenths is null or current_odometer_tenths >= 0),
  constraint vehicles_prices_non_negative
    check (coalesce(purchase_price_cents, 0) >= 0 and coalesce(insurance_cost_cents, 0) >= 0)
);

comment on table vehicles is
  'BOYD''S fleet. Every specification column is nullable on purpose: a null is NOT CONFIGURED, and BOYD''S would rather show that than an invented figure.';
comment on column vehicles.status is
  'Driven by operational events (assignment, job progress, maintenance), not by free editing. See enforce_vehicle_status_change().';

create index vehicles_status_idx on vehicles (status) where active;

create trigger vehicles_set_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

-- --- Vehicle status is operational, not editorial ----------------------------

create table vehicle_status_history (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references vehicles (id) on delete cascade,
  from_status  vehicle_status,
  to_status    vehicle_status not null,
  reason       text not null,
  job_id       uuid,
  changed_by   uuid references users (id) on delete set null,
  changed_at   timestamptz not null default now()
);

create index vehicle_status_history_vehicle_idx
  on vehicle_status_history (vehicle_id, changed_at desc);

-- ASSIGNED and IN_TRANSIT are consequences of job activity. A partner may set
-- the states that describe the vehicle itself — availability, maintenance,
-- service — but cannot declare a van "in transit" when no job is moving it.
create or replace function enforce_vehicle_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('ASSIGNED', 'IN_TRANSIT')
       and coalesce(current_setting('boyds.operational_status_change', true), '') <> 'on'
    then
      raise exception
        'Vehicle status % is set by job activity, not by editing. Assign or progress a job instead.',
        new.status
        using errcode = 'check_violation';
    end if;

    insert into vehicle_status_history (vehicle_id, from_status, to_status, reason, changed_by)
    values (
      new.id,
      old.status,
      new.status,
      coalesce(current_setting('boyds.status_change_reason', true), 'Status changed'),
      current_app_user_id()
    );
  end if;

  return new;
end;
$$;

create trigger vehicles_enforce_status_change
  before update on vehicles
  for each row execute function enforce_vehicle_status_change();

-- --- drivers: extended from the Phase 2 record --------------------------------
-- A person may be a partner, a driver, both, or neither. These are independent
-- records deliberately: partnership is a business relationship, driving is an
-- operational role, and neither implies the other.

alter table drivers
  add column status              driver_status not null default 'ACTIVE',
  add column availability        driver_availability not null default 'AVAILABLE',
  add column current_vehicle_id  uuid references vehicles (id) on delete set null,
  add column current_location    text,
  add column location_updated_at timestamptz,
  add column notes               text,
  add column provenance          data_provenance not null default 'REAL';

comment on column drivers.current_location is
  'A text description only, recorded manually. BOYD''S has no GPS integration: live location is UNAVAILABLE, and nothing here simulates it. See docs/INTEGRATIONS.md.';
comment on column drivers.availability is
  'AVAILABLE, ON_JOB, OFF_DUTY or UNAVAILABLE. ON_JOB is set by job activity, not by editing.';

create index drivers_availability_idx on drivers (availability) where active and status = 'ACTIVE';
