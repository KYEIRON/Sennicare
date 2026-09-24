-- =============================================================================
-- BOYD'S Logistics LLC — 0024 incidents
--
-- What happened on the road. A breakdown, an accident, damaged goods, a
-- customer who was not there, a traffic stop.
--
-- Moh reports these from the van, in the moment, from a phone. The report is
-- his account of events and is treated as such: once filed it cannot be edited
-- or deleted by a driver, because an incident record that can be quietly
-- rewritten is worth nothing to an insurer, to a customer, or to a partner
-- trying to understand what went wrong.
--
-- Nothing here is inferred. The system does not know where the van was, so the
-- location is what the driver types. It does not know what the damage cost, so
-- the cost stays null until someone finds out. See the master instruction,
-- section 29.
-- =============================================================================

create type incident_type as enum (
  'ACCIDENT',
  'VEHICLE_BREAKDOWN',
  'VEHICLE_DAMAGE',
  'GOODS_DAMAGED',
  'GOODS_LOST',
  'THEFT',
  'CUSTOMER_UNAVAILABLE',
  'ACCESS_REFUSED',
  'DELAY',
  'WEATHER',
  'TRAFFIC_STOP',
  'INJURY',
  'OTHER'
);

create type incident_severity as enum ('MINOR', 'SERIOUS', 'CRITICAL');

create type incident_status as enum ('REPORTED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

create table incidents (
  id                  uuid primary key default gen_random_uuid(),
  incident_number     text not null unique,
  incident_type       incident_type not null,
  severity            incident_severity not null,
  status              incident_status not null default 'REPORTED',

  -- An incident can happen between jobs, so the job is optional. The vehicle
  -- and the driver are not: something happened to somebody, in something.
  job_id              uuid references jobs (id) on delete restrict,
  vehicle_id          uuid not null references vehicles (id) on delete restrict,
  driver_id           uuid not null references drivers (id) on delete restrict,

  occurred_at         timestamptz not null default now(),

  -- Typed by the driver. There is no GPS integration, and a fabricated
  -- coordinate would be worse than a sentence describing the place.
  location_description text,

  description         text not null,

  -- Facts a partner will be asked for by an insurer or a customer. Each is a
  -- deliberate yes or no from the driver rather than a default: "not recorded"
  -- and "no" are different answers, and the form makes him choose.
  anyone_injured      boolean not null,
  police_involved     boolean not null,
  police_report_number text,
  third_party_involved boolean not null,
  third_party_details text,
  goods_affected      boolean not null,

  -- Unknown at the time of reporting, and it stays unknown until someone finds
  -- out. Never zero: a cost of nothing is a claim that it was free.
  cost_cents          bigint,

  reported_by         uuid references users (id) on delete set null,
  reviewed_by         uuid references users (id) on delete set null,
  reviewed_at         timestamptz,
  resolution_notes    text,

  provenance          data_provenance not null default 'REAL',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint incidents_description_present
    check (length(btrim(description)) > 0),
  constraint incidents_resolved_has_notes check (
    status not in ('RESOLVED', 'CLOSED')
    or length(btrim(coalesce(resolution_notes, ''))) > 0
  ),
  constraint incidents_police_report_needs_police check (
    police_report_number is null or police_involved
  ),
  constraint incidents_third_party_details_need_third_party check (
    third_party_details is null or third_party_involved
  ),
  constraint incidents_cost_not_negative check (cost_cents is null or cost_cents >= 0)
);

comment on table incidents is
  'What happened on the road, as the driver reported it. Immutable to drivers once filed: an incident record that can be quietly rewritten is worth nothing to an insurer.';
comment on column incidents.location_description is
  'Where it happened, in the driver''s words. BOYD''S has no GPS integration and will not fabricate a position.';
comment on column incidents.cost_cents is
  'What the incident cost BOYD''S, once known. Null means not yet established — never zero.';

create index incidents_status_idx on incidents (status, occurred_at desc);
create index incidents_job_idx on incidents (job_id) where job_id is not null;
create index incidents_driver_idx on incidents (driver_id, occurred_at desc);
create index incidents_vehicle_idx on incidents (vehicle_id, occurred_at desc);

create trigger incidents_set_updated_at
  before update on incidents
  for each row execute function set_updated_at();

create trigger incidents_audit
  after insert or update on incidents
  for each row execute function write_audit_log();

-- A filed report is a driver's account of events. Corrections are a partner
-- action, and the original stays in the audit trail.
create trigger incidents_driver_immutable
  before update or delete on incidents
  for each row execute function enforce_driver_record_immutability();

-- --- Photographs of the scene ------------------------------------------------

alter table documents drop constraint documents_entity_known;
alter table documents add constraint documents_entity_known
  check (entity_table in (
    'jobs', 'job_stops', 'vehicles', 'customers', 'job_expenses', 'incidents'
  ));

-- --- Telling the partners ----------------------------------------------------

alter type notification_type add value if not exists 'INCIDENT_REPORTED';

-- --- Reference numbers -------------------------------------------------------
--
-- From a sequence, not a row count. Two reports filed at once would otherwise
-- claim the same number, and the driver would see a failure at the roadside.
-- The number is assigned here rather than by the application: it is a reference
-- BOYD'S may quote to an insurer, and it is not the reporter's to choose.

create sequence incident_number_seq;

create or replace function assign_incident_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.incident_number := 'BI-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('incident_number_seq')::text, 4, '0');
  return new;
end;
$$;

create trigger incidents_assign_number
  before insert on incidents
  for each row execute function assign_incident_number();

-- --- Telling the partners ----------------------------------------------------
--
-- A report filed from the van is of no use sitting unread. Raised by a trigger
-- so it cannot be skipped, and so it cannot be forged: notify_partners is
-- executable by nobody (migration 0023).

create or replace function notify_partners_of_incident()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  severity notification_severity;
begin
  severity := case new.severity
    when 'MINOR' then 'ATTENTION'::notification_severity
    else 'URGENT'::notification_severity
  end;

  perform notify_partners(
    'INCIDENT_REPORTED'::notification_type,
    severity,
    new.incident_number || ': ' || replace(new.incident_type::text, '_', ' '),
    left(new.description, 500),
    'incidents',
    new.id
  );

  return new;
end;
$$;

create trigger incidents_notify
  after insert on incidents
  for each row execute function notify_partners_of_incident();

-- --- Row level security ------------------------------------------------------

alter table incidents enable row level security;
alter table incidents force row level security;

create policy incidents_partner on incidents
  for all using (is_partner()) with check (is_partner());

-- A driver sees the reports he filed, and files new ones against himself. He
-- cannot file a report in another driver's name, and cannot read theirs.
create policy incidents_driver_own on incidents
  for select using (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

create policy incidents_driver_insert on incidents
  for insert with check (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

revoke all on incidents from anon, authenticated;
grant select, insert, update, delete on incidents to authenticated;

-- The sequence is driven by the trigger, which runs as its definer. Nobody
-- calls nextval directly.
revoke all on sequence incident_number_seq from anon, authenticated;

-- --- Function EXECUTE --------------------------------------------------------
--
-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default. Both of
-- these are trigger functions, invoked by their triggers regardless of the
-- caller's privilege, so they are granted to nobody. See migration 0023 and
-- tests/integration/function-permissions.test.ts, which asserts the exact list
-- of functions anon may execute.

revoke all on function assign_incident_number() from public, anon, authenticated;
revoke all on function notify_partners_of_incident() from public, anon, authenticated;
