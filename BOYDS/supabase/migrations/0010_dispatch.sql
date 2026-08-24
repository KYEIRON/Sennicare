-- =============================================================================
-- BOYD'S Logistics LLC — 0010 dispatch rules
--
-- Prevents double booking, conflicting times, and assignment of inactive
-- vehicles or drivers. Written for N vehicles and N drivers: BOYD'S runs one van
-- today, and none of these rules assume it.
-- =============================================================================

-- Statuses in which a job actually occupies a vehicle and a driver. A cancelled,
-- declined, completed or held job does not tie anything up.
create or replace function job_status_occupies_resources(status job_status)
returns boolean
language sql
immutable
as $$
  select status in (
    'ASSIGNED', 'DRIVER_ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'AT_PICKUP',
    'PICKED_UP', 'IN_TRANSIT', 'AT_DELIVERY', 'DELIVERED', 'POD_RECEIVED'
  );
$$;

/**
 * The scheduled window of a job.
 *
 * BOYD'S does not yet estimate durations from real route data, so a job with no
 * stated window is treated as occupying a default block. That block is a
 * SCHEDULING assumption, not a business figure, and it never reaches a cost or
 * a contribution calculation.
 */
create or replace function job_scheduled_window(
  scheduled_date date,
  scheduled_time time,
  window_end time
)
returns tstzrange
language sql
immutable
as $$
  select case
    when scheduled_date is null or scheduled_time is null then null
    else tstzrange(
      (scheduled_date + scheduled_time) at time zone 'America/New_York',
      (scheduled_date + coalesce(window_end, scheduled_time + interval '2 hours'))
        at time zone 'America/New_York',
      '[)'
    )
  end;
$$;

comment on function job_scheduled_window is
  'The time a job occupies. The two-hour default when no window end is given is a scheduling assumption only — it never enters a cost or contribution figure.';

-- --- Conflict detection ------------------------------------------------------

create or replace function find_dispatch_conflicts(
  p_job_id uuid,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_scheduled_date date,
  p_scheduled_time time,
  p_window_end time
)
returns table (
  conflict_type text,
  conflicting_job_id uuid,
  conflicting_job_number text,
  detail text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with window_under_test as (
    select job_scheduled_window(p_scheduled_date, p_scheduled_time, p_window_end) as w
  )
  -- Vehicle already committed in an overlapping window
  select
    'VEHICLE_DOUBLE_BOOKED'::text,
    j.id,
    j.job_number,
    format('Vehicle already committed to %s at that time', j.job_number)
  from jobs j, window_under_test wut
  where p_vehicle_id is not null
    and j.vehicle_id = p_vehicle_id
    and j.id is distinct from p_job_id
    and job_status_occupies_resources(j.status)
    and wut.w is not null
    and job_scheduled_window(j.scheduled_date, j.scheduled_time, j.scheduled_window_end) && wut.w

  union all

  -- Driver already committed in an overlapping window
  select
    'DRIVER_DOUBLE_BOOKED'::text,
    j.id,
    j.job_number,
    format('Driver already committed to %s at that time', j.job_number)
  from jobs j, window_under_test wut
  where p_driver_id is not null
    and j.driver_id = p_driver_id
    and j.id is distinct from p_job_id
    and job_status_occupies_resources(j.status)
    and wut.w is not null
    and job_scheduled_window(j.scheduled_date, j.scheduled_time, j.scheduled_window_end) && wut.w

  union all

  -- Vehicle not in a state that can take work
  select
    'VEHICLE_UNAVAILABLE'::text,
    null::uuid,
    null::text,
    format('Vehicle %s is %s', v.vehicle_code, v.status)
  from vehicles v
  where v.id = p_vehicle_id
    and (not v.active or v.status in ('MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'))

  union all

  -- Driver not in a state that can take work
  select
    'DRIVER_UNAVAILABLE'::text,
    null::uuid,
    null::text,
    format('Driver is %s / %s', d.status, d.availability)
  from drivers d
  where d.id = p_driver_id
    and (not d.active or d.status <> 'ACTIVE' or d.availability = 'UNAVAILABLE');
$$;

comment on function find_dispatch_conflicts is
  'Every reason a proposed assignment cannot go ahead. Returns rows rather than raising, so the interface can show a partner all conflicts at once instead of one at a time.';

-- --- Enforcement at assignment ----------------------------------------------

create or replace function enforce_dispatch_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  conflict record;
begin
  -- Only check when an assignment or its timing actually changes.
  if tg_op = 'UPDATE'
     and new.vehicle_id is not distinct from old.vehicle_id
     and new.driver_id is not distinct from old.driver_id
     and new.scheduled_date is not distinct from old.scheduled_date
     and new.scheduled_time is not distinct from old.scheduled_time
     and new.scheduled_window_end is not distinct from old.scheduled_window_end
     and new.status is not distinct from old.status
  then
    return new;
  end if;

  if not job_status_occupies_resources(new.status) then
    return new;
  end if;

  select * into conflict
  from find_dispatch_conflicts(
    new.id, new.vehicle_id, new.driver_id,
    new.scheduled_date, new.scheduled_time, new.scheduled_window_end
  )
  limit 1;

  if found then
    raise exception 'Dispatch conflict (%): %', conflict.conflict_type, conflict.detail
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger jobs_enforce_dispatch_rules
  before insert or update on jobs
  for each row execute function enforce_dispatch_rules();

-- --- Resource state follows job activity ------------------------------------

create or replace function sync_resource_state_from_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  moving boolean;
begin
  if new.status is not distinct from old.status
     and new.vehicle_id is not distinct from old.vehicle_id
     and new.driver_id is not distinct from old.driver_id then
    return new;
  end if;

  moving := new.status in ('EN_ROUTE_TO_PICKUP', 'AT_PICKUP', 'PICKED_UP',
                           'IN_TRANSIT', 'AT_DELIVERY');

  -- These writes are operational consequences, so they are permitted to set the
  -- statuses a partner cannot set by hand.
  perform set_config('boyds.operational_status_change', 'on', true);
  perform set_config('boyds.status_change_reason',
                     format('Job %s is %s', new.job_number, new.status), true);

  if new.vehicle_id is not null then
    update vehicles
    set status = case
          when moving then 'IN_TRANSIT'::vehicle_status
          when job_status_occupies_resources(new.status) then 'ASSIGNED'::vehicle_status
          else 'AVAILABLE'::vehicle_status
        end
    where id = new.vehicle_id
      and status not in ('MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE');
  end if;

  -- A vehicle released by reassignment goes back to available.
  if tg_op = 'UPDATE' and old.vehicle_id is not null
     and old.vehicle_id is distinct from new.vehicle_id then
    update vehicles set status = 'AVAILABLE'
    where id = old.vehicle_id
      and status not in ('MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE');
  end if;

  if new.driver_id is not null then
    update drivers
    set availability = case
          when job_status_occupies_resources(new.status) then 'ON_JOB'::driver_availability
          else 'AVAILABLE'::driver_availability
        end,
        current_vehicle_id = case
          when job_status_occupies_resources(new.status) then new.vehicle_id
          else current_vehicle_id
        end
    where id = new.driver_id and availability <> 'OFF_DUTY';
  end if;

  if tg_op = 'UPDATE' and old.driver_id is not null
     and old.driver_id is distinct from new.driver_id then
    update drivers set availability = 'AVAILABLE'
    where id = old.driver_id and availability = 'ON_JOB';
  end if;

  perform set_config('boyds.operational_status_change', 'off', true);
  return new;
end;
$$;

create trigger jobs_sync_resource_state
  after insert or update on jobs
  for each row execute function sync_resource_state_from_job();
