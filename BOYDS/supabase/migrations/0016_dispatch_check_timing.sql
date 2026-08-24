-- =============================================================================
-- BOYD'S Logistics LLC — 0016 check dispatch conflicts at commitment, not on
-- every field update
--
-- PROBLEM: enforce_dispatch_rules() re-validated availability on EVERY status
-- change of a live job. So if a van went into MAINTENANCE mid-job — which is
-- exactly what happens when it breaks down — the driver could no longer record
-- what was happening, because each progress update was re-checked against a
-- vehicle that was now unavailable.
--
-- That is backwards. The van is already out on the road; refusing to record
-- reality does not put it back. Blocking progress here would push a partner
-- towards editing data to work around the software, which is how records stop
-- being trustworthy.
--
-- FIX: check conflicts when an assignment is actually being made or changed —
-- the vehicle, the driver or the schedule changes, or the job crosses from a
-- non-committed status into a committed one. Progress between committed
-- statuses is recording what happened, not making a new commitment.
--
-- This does not weaken double-booking prevention: every route by which a
-- resource becomes committed still passes through the check.
-- =============================================================================

create or replace function enforce_dispatch_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  conflict record;
  assignment_changed boolean;
  newly_committed boolean;
begin
  if tg_op = 'INSERT' then
    assignment_changed := new.vehicle_id is not null or new.driver_id is not null;
    newly_committed := job_status_occupies_resources(new.status);
  else
    assignment_changed :=
      new.vehicle_id is distinct from old.vehicle_id
      or new.driver_id is distinct from old.driver_id
      or new.scheduled_date is distinct from old.scheduled_date
      or new.scheduled_time is distinct from old.scheduled_time
      or new.scheduled_window_end is distinct from old.scheduled_window_end;

    -- The moment of commitment: a job that was not holding resources now is.
    newly_committed :=
      job_status_occupies_resources(new.status)
      and not job_status_occupies_resources(old.status);
  end if;

  if not (assignment_changed or newly_committed) then
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

comment on function enforce_dispatch_rules is
  'Rejects an assignment that would double-book a vehicle or driver, or commit an unavailable one. Runs when an assignment is made or changed, not on every progress update — a van that breaks down mid-job must not stop the driver recording what happened.';
