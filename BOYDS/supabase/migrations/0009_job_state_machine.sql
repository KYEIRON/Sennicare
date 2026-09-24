-- =============================================================================
-- BOYD'S Logistics LLC — 0009 job status state machine
--
-- Every permitted transition is a ROW in job_status_transitions. Anything not
-- listed is rejected. The same table is mirrored in
-- src/services/jobs/state-machine.ts and a test asserts the two are identical,
-- so one source of truth is enforced at two independent layers.
--
-- COMPLETED -> REQUESTED, and every other nonsensical move, is rejected because
-- it simply is not in the table.
-- =============================================================================

create table job_status_transitions (
  from_status  job_status not null,
  to_status    job_status not null,
  description  text not null,
  primary key (from_status, to_status)
);

comment on table job_status_transitions is
  'The complete job lifecycle. A transition absent from this table cannot happen.';

insert into job_status_transitions (from_status, to_status, description) values
  -- Intake and commercial
  ('REQUESTED',          'REVIEW',             'A partner picks the request up for review'),
  ('REQUESTED',          'DECLINED',           'BOYD''S declines the request'),
  ('REQUESTED',          'CANCELLED',          'The customer withdraws before review'),
  ('REVIEW',             'QUOTED',             'A price is quoted to the customer'),
  ('REVIEW',             'APPROVED',           'Approved directly, without a formal quote'),
  ('REVIEW',             'DECLINED',           'BOYD''S declines after reviewing'),
  ('REVIEW',             'ON_HOLD',            'Waiting on the customer or on information'),
  ('REVIEW',             'CANCELLED',          'Cancelled during review'),
  ('QUOTED',             'APPROVED',           'The customer accepts the quote'),
  ('QUOTED',             'DECLINED',           'The customer declines the quote'),
  ('QUOTED',             'REVIEW',             'Requoting — back to review'),
  ('QUOTED',             'ON_HOLD',            'Quote issued, awaiting a decision'),
  ('QUOTED',             'CANCELLED',          'Cancelled after quoting'),

  -- Planning
  ('APPROVED',           'SCHEDULED',          'Placed on the schedule'),
  ('APPROVED',           'ON_HOLD',            'Approved but not yet schedulable'),
  ('APPROVED',           'CANCELLED',          'Cancelled after approval'),
  ('SCHEDULED',          'ASSIGNED',           'A vehicle and driver are assigned'),
  ('SCHEDULED',          'ON_HOLD',            'Held before assignment'),
  ('SCHEDULED',          'CANCELLED',          'Cancelled before assignment'),
  ('ASSIGNED',           'DRIVER_ACCEPTED',    'The assigned driver accepts the job'),
  ('ASSIGNED',           'SCHEDULED',          'Unassigned — back to the schedule'),
  ('ASSIGNED',           'ON_HOLD',            'Held after assignment'),
  ('ASSIGNED',           'CANCELLED',          'Cancelled after assignment'),

  -- Field execution
  ('DRIVER_ACCEPTED',    'EN_ROUTE_TO_PICKUP', 'The driver sets off for the pickup'),
  ('DRIVER_ACCEPTED',    'ASSIGNED',           'Reassigned to a different driver'),
  ('DRIVER_ACCEPTED',    'ON_HOLD',            'Held after the driver accepted'),
  ('DRIVER_ACCEPTED',    'CANCELLED',          'Cancelled before departure'),
  ('EN_ROUTE_TO_PICKUP', 'AT_PICKUP',          'The driver arrives at the pickup'),
  ('EN_ROUTE_TO_PICKUP', 'FAILED',             'Could not reach the pickup'),
  ('EN_ROUTE_TO_PICKUP', 'CANCELLED',          'Cancelled while en route'),
  ('AT_PICKUP',          'PICKED_UP',          'The goods are collected'),
  ('AT_PICKUP',          'FAILED',             'Nothing available to collect'),
  ('AT_PICKUP',          'CANCELLED',          'Cancelled at the pickup'),
  ('PICKED_UP',          'IN_TRANSIT',         'On the road to the delivery'),
  ('PICKED_UP',          'FAILED',             'Failed after collection'),
  ('IN_TRANSIT',         'AT_DELIVERY',        'The driver arrives at the delivery'),
  ('IN_TRANSIT',         'FAILED',             'Failed in transit'),
  ('IN_TRANSIT',         'ON_HOLD',            'Held in transit — an exception on the road'),
  ('AT_DELIVERY',        'DELIVERED',          'The goods are handed over'),
  ('AT_DELIVERY',        'FAILED',             'Delivery refused or impossible'),

  -- Closing
  ('DELIVERED',          'POD_RECEIVED',       'Proof of delivery is captured'),
  ('POD_RECEIVED',       'COMPLETED',          'The job is complete'),

  -- Returning from a hold: back to where the job actually was
  ('ON_HOLD',            'REVIEW',             'Resumed at review'),
  ('ON_HOLD',            'QUOTED',             'Resumed at quoted'),
  ('ON_HOLD',            'APPROVED',           'Resumed at approved'),
  ('ON_HOLD',            'SCHEDULED',          'Resumed on the schedule'),
  ('ON_HOLD',            'ASSIGNED',           'Resumed as assigned'),
  ('ON_HOLD',            'IN_TRANSIT',         'Resumed in transit'),
  ('ON_HOLD',            'CANCELLED',          'Cancelled while on hold'),

  -- A failed job can be retried or closed off
  ('FAILED',             'SCHEDULED',          'Rescheduled after a failure'),
  ('FAILED',             'CANCELLED',          'Abandoned after a failure'),
  ('FAILED',             'COMPLETED',          'Closed off — work done, outcome recorded');

-- --- Enforcement -------------------------------------------------------------

create or replace function enforce_job_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  pod_count integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not exists (
    select 1 from job_status_transitions
    where from_status = old.status and to_status = new.status
  ) then
    raise exception 'A job cannot move from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- Guards on specific transitions. These are business rules 4, 8 and 9.

  if new.status = 'ASSIGNED'
     and (new.vehicle_id is null or new.driver_id is null) then
    raise exception 'A job cannot be ASSIGNED without both a vehicle and a driver.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'DRIVER_ACCEPTED' and new.driver_id is null then
    raise exception 'A job cannot be DRIVER_ACCEPTED without an assigned driver.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'COMPLETED' and old.status <> 'FAILED'
     and new.actual_miles_tenths is null then
    raise exception 'A job cannot be COMPLETED before actual mileage is recorded.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'CANCELLED'
     and length(btrim(coalesce(new.cancellation_reason, ''))) = 0 then
    raise exception 'Cancelling a job requires a reason.'
      using errcode = 'check_violation';
  end if;

  -- Stamp the operational timestamps here so they cannot be forgotten or faked
  -- by whichever code path performed the update.
  if new.status = 'ASSIGNED' and new.assigned_at is null then
    new.assigned_at := now();
  end if;
  if new.status = 'DRIVER_ACCEPTED' and new.driver_accepted_at is null then
    new.driver_accepted_at := now();
  end if;
  if new.status = 'EN_ROUTE_TO_PICKUP' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status = 'PICKED_UP' and new.picked_up_at is null then
    new.picked_up_at := now();
  end if;
  if new.status = 'DELIVERED' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  if new.status = 'COMPLETED' and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status = 'CANCELLED' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

create trigger jobs_enforce_status_transition
  before update on jobs
  for each row execute function enforce_job_status_transition();

-- A new job may only start at an intake status. Nothing is created mid-flight.
create or replace function enforce_job_initial_status()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('REQUESTED', 'REVIEW', 'QUOTED', 'APPROVED') then
    raise exception 'A new job must start at REQUESTED, REVIEW, QUOTED or APPROVED, not %.',
      new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger jobs_enforce_initial_status
  before insert on jobs
  for each row execute function enforce_job_initial_status();
