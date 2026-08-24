-- =============================================================================
-- BOYD'S Logistics LLC — 0018 vehicle economics and maintenance
--
-- TRUE COST PER MILE IS DERIVED, NEVER DECLARED.
--
-- There is deliberately no column anywhere for a manually entered flat cost per
-- mile. A typed-in rate is a guess wearing a number's clothing, and every job's
-- contribution would inherit that guess invisibly. The rate is computed from
-- real recorded costs divided by real recorded mileage, and it always reports
-- which cost lines it actually covers.
--
-- See docs/DECISIONS.md D-012.
-- =============================================================================

create type vehicle_cost_line as enum (
  'FUEL', 'INSURANCE', 'FINANCE', 'DEPRECIATION', 'MAINTENANCE',
  'REPAIRS', 'TYRES', 'REGISTRATION', 'OTHER_OPERATING'
);

create type vehicle_cost_period as enum ('MONTHLY', 'ANNUAL', 'PER_MILE', 'ONE_OFF');

create type maintenance_type as enum (
  'SERVICE', 'OIL', 'TYRES', 'REPAIR', 'INSPECTION', 'REGISTRATION', 'INSURANCE', 'OTHER'
);

-- --- The configurable cost model --------------------------------------------

create table vehicle_cost_entries (
  id                       uuid primary key default gen_random_uuid(),
  vehicle_id               uuid not null references vehicles (id) on delete cascade,
  cost_line                vehicle_cost_line not null,
  period                   vehicle_cost_period not null,
  amount_cents             bigint not null,

  -- The partners decide which lines count towards true cost per mile. A cost
  -- can be recorded for the books without being charged to jobs.
  included_in_cost_per_mile boolean not null default true,

  effective_from           date not null,
  effective_to             date,
  notes                    text,
  created_by               uuid references users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint vehicle_cost_amount_non_negative check (amount_cents >= 0),
  constraint vehicle_cost_period_sane check (effective_to is null or effective_to >= effective_from)
);

comment on table vehicle_cost_entries is
  'Real costs BOYD''S actually pays for a vehicle. No industry averages, no assumed depreciation curves — an entry exists because a real amount was paid or is contracted.';
comment on column vehicle_cost_entries.included_in_cost_per_mile is
  'Whether the partners count this line towards true cost per mile. Excluding a line does not delete it; the figure simply reports which lines it covers.';

create index vehicle_cost_entries_vehicle_idx
  on vehicle_cost_entries (vehicle_id, effective_from desc);

create trigger vehicle_cost_entries_set_updated_at
  before update on vehicle_cost_entries
  for each row execute function set_updated_at();

-- --- Maintenance -------------------------------------------------------------

create table maintenance_records (
  id                        uuid primary key default gen_random_uuid(),
  vehicle_id                uuid not null references vehicles (id) on delete restrict,
  maintenance_type          maintenance_type not null,
  description               text,
  due_date                  date,
  due_odometer_tenths       integer,
  completed_date            date,
  completed_odometer_tenths integer,
  cost_cents                bigint,
  vendor                    text,
  notes                     text,
  created_by                uuid references users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint maintenance_cost_non_negative check (cost_cents is null or cost_cents >= 0),
  -- Something must say when it is due, or it is not a reminder.
  constraint maintenance_has_a_trigger
    check (due_date is not null or due_odometer_tenths is not null or completed_date is not null)
);

comment on table maintenance_records is
  'Scheduled and completed vehicle work. A record with no cost recorded reads as MISSING — an unpriced service is not a free one.';

create index maintenance_due_idx on maintenance_records (vehicle_id, due_date)
  where completed_date is null;

create trigger maintenance_records_set_updated_at
  before update on maintenance_records
  for each row execute function set_updated_at();

-- Completed maintenance with a cost becomes a vehicle cost entry, so the true
-- cost per mile reflects work actually done rather than only planned costs.
create or replace function maintenance_to_cost_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.completed_date is not null
     and new.cost_cents is not null
     and (tg_op = 'INSERT' or old.completed_date is null or old.cost_cents is distinct from new.cost_cents)
  then
    delete from vehicle_cost_entries
    where vehicle_id = new.vehicle_id
      and notes = 'maintenance:' || new.id::text;

    insert into vehicle_cost_entries (
      vehicle_id, cost_line, period, amount_cents,
      included_in_cost_per_mile, effective_from, notes, created_by
    )
    values (
      new.vehicle_id,
      case new.maintenance_type
        when 'TYRES' then 'TYRES'::vehicle_cost_line
        when 'REPAIR' then 'REPAIRS'::vehicle_cost_line
        when 'INSURANCE' then 'INSURANCE'::vehicle_cost_line
        when 'REGISTRATION' then 'REGISTRATION'::vehicle_cost_line
        else 'MAINTENANCE'::vehicle_cost_line
      end,
      'ONE_OFF',
      new.cost_cents,
      true,
      new.completed_date,
      'maintenance:' || new.id::text,
      new.created_by
    );
  end if;

  return null;
end;
$$;

create trigger maintenance_records_cost_entry
  after insert or update on maintenance_records
  for each row execute function maintenance_to_cost_entry();

-- --- Row level security ------------------------------------------------------

alter table vehicle_cost_entries enable row level security;
alter table maintenance_records enable row level security;
alter table vehicle_cost_entries force row level security;
alter table maintenance_records force row level security;

-- Vehicle costs are company financial information. Partners only — a driver has
-- no policy here at all, so a driver reading this table gets zero rows.
create policy vehicle_cost_entries_partner on vehicle_cost_entries
  for all using (is_partner()) with check (is_partner());

create policy maintenance_partner on maintenance_records
  for all using (is_partner()) with check (is_partner());

-- A driver sees maintenance due on the vehicle they are currently in, so they
-- know the van needs a service. No cost column reaches them: they read this
-- through the view below.
create view driver_vehicle_maintenance
with (security_invoker = false)
as
select
  m.id,
  m.vehicle_id,
  m.maintenance_type,
  m.description,
  m.due_date,
  m.due_odometer_tenths,
  m.completed_date
from maintenance_records m
where m.vehicle_id in (
  select d.current_vehicle_id from drivers d
  where d.user_id = current_app_user_id() and d.current_vehicle_id is not null
);

comment on view driver_vehicle_maintenance is
  'Maintenance due on the driver''s current vehicle. Contains no cost or vendor column — a driver needs to know the van is due a service, not what it costs.';

revoke all on vehicle_cost_entries, maintenance_records from anon, authenticated;
grant select, insert, update, delete on vehicle_cost_entries, maintenance_records
  to authenticated;
grant select on driver_vehicle_maintenance to authenticated;

create trigger vehicle_cost_entries_audit
  after insert or update on vehicle_cost_entries
  for each row execute function write_audit_log();
