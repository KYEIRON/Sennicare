-- =============================================================================
-- BOYD'S Logistics LLC — 0014 correct the driver column guards
--
-- BUG: enforce_driver_self_update_columns() (0003) and
-- enforce_driver_job_update_columns() (0013) both allowed the write only when
-- is_partner() was true, and blocked everyone else. is_partner() is false for
-- ANY session that does not resolve to an active partner — including the
-- service role, a migration, and a scheduled task. So legitimate server-side
-- writes were rejected with a message about drivers.
--
-- FIX: the rule is "a DRIVER may not write these columns", so the guard now
-- applies to driver sessions specifically and returns early for everyone else.
--
-- This does not weaken anything. Row level security already decides WHO may
-- update these tables at all: a session that is neither a partner nor the
-- assigned driver matches no update policy and cannot reach this trigger with a
-- row to change. The trigger's only job is column restriction WITHIN a driver's
-- own permitted rows.
-- =============================================================================

create or replace function enforce_driver_self_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Applies to driver sessions only. Partners, the service role and migrations
  -- are governed by row level security, not by this column guard.
  if not is_driver() then
    return new;
  end if;

  if new.id             is distinct from old.id
     or new.user_id        is distinct from old.user_id
     or new.license_number is distinct from old.license_number
     or new.license_state  is distinct from old.license_state
     or new.license_expiry is distinct from old.license_expiry
     or new.active         is distinct from old.active
     or new.status         is distinct from old.status
     or new.created_at     is distinct from old.created_at
  then
    raise exception
      'A driver may only update their own phone number. Licence details and status are maintained by a partner.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create or replace function enforce_driver_job_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not is_driver() then
    return new;
  end if;

  if new.quoted_price_cents is distinct from old.quoted_price_cents
     or new.won_price_cents is distinct from old.won_price_cents
     or new.fuel_cost_estimated_cents is distinct from old.fuel_cost_estimated_cents
     or new.driver_cost_estimated_cents is distinct from old.driver_cost_estimated_cents
     or new.driver_cost_actual_cents is distinct from old.driver_cost_actual_cents
     or new.vehicle_cost_estimated_cents is distinct from old.vehicle_cost_estimated_cents
     or new.vehicle_cost_actual_cents is distinct from old.vehicle_cost_actual_cents
     or new.customer_id is distinct from old.customer_id
     or new.vehicle_id is distinct from old.vehicle_id
     or new.driver_id is distinct from old.driver_id
     or new.internal_notes is distinct from old.internal_notes
  then
    raise exception
      'A driver may record field progress and their own costs, not pricing, assignment or internal notes.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
