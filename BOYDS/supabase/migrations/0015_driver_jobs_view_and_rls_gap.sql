-- =============================================================================
-- BOYD'S Logistics LLC — 0015 fix the driver_jobs view and an RLS gap
--
-- TWO CORRECTIONS.
--
-- 1. driver_jobs returned nothing for a driver.
--    The view was created with security_invoker = true, so it ran under the
--    caller's own permissions — and a driver correctly sees ZERO customers, so
--    the join to customers emptied the result.
--
--    The fix is to run the view with the owner's permissions and filter to the
--    caller's own jobs INSIDE the view. That is stronger than the original
--    design, not weaker: the view now decides both which rows (the caller's
--    assigned jobs) and which columns (no price, cost, contribution or margin
--    exists in it), and it hands over exactly one field from customers — the
--    company name the driver needs in order to do the job.
--
--    Row level security on the base tables is unchanged: a driver querying
--    `jobs` or `customers` directly is restricted exactly as before.
--
-- 2. job_status_transitions had row level security enabled nowhere.
--    It is reference data, not business data, but BOYD'S rule is that EVERY
--    table has RLS with no exceptions — an exception is how the next gap gets
--    missed. Enabled with a read policy for signed-in users.
-- =============================================================================

drop view if exists driver_jobs;

create view driver_jobs
with (security_invoker = false)
as
select
  j.id,
  j.job_number,
  j.status,
  j.priority,
  j.description,
  j.quantity,
  j.weight_lbs,
  j.dimensions,
  j.pallets,
  j.special_handling,
  j.scheduled_date,
  j.scheduled_time,
  j.scheduled_window_end,
  j.vehicle_id,
  j.driver_id,
  j.driver_accepted_at,
  j.started_at,
  j.picked_up_at,
  j.delivered_at,
  j.completed_at,
  j.actual_miles_tenths,
  j.start_odometer_tenths,
  j.end_odometer_tenths,
  j.notes,
  c.company_name as customer_company_name,
  jt.name        as job_type_name,
  v.vehicle_code,
  j.created_at,
  j.updated_at
from jobs j
join customers c on c.id = j.customer_id
join job_types jt on jt.id = j.job_type_id
left join vehicles v on v.id = j.vehicle_id
where j.driver_id in (
  select d.id from drivers d where d.user_id = current_app_user_id()
);

comment on view driver_jobs is
  'What a driver may see of their own work. Runs with the owner''s permissions and filters to the caller''s assigned jobs, so it decides both rows and columns. It contains no price, cost, contribution, margin or internal-notes column — that protection is structural, not a filter someone could forget. Only the customer''s company name crosses over from customers; nothing else about the customer is exposed.';

grant select on driver_jobs to authenticated;

-- --- The RLS gap -------------------------------------------------------------

alter table job_status_transitions enable row level security;
alter table job_status_transitions force row level security;

create policy job_status_transitions_select on job_status_transitions
  for select using (current_app_user_id() is not null);

-- Deliberately no write policy: the lifecycle changes by migration, reviewed
-- alongside the TypeScript mirror in src/services/jobs/state-machine.ts, never
-- by an application write.
