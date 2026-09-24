-- =============================================================================
-- BOYD'S Logistics LLC — 0013 row level security for operations
--
-- The Phase 2 boundary extended to every operational table. The driver surface
-- must never reach a price, a cost, a contribution, a margin, a customer list,
-- or another driver's work — business rules 27 to 30.
-- =============================================================================

-- --- The driver's view of a job: no financial columns exist in it ------------
--
-- Column-level protection by construction. The driver application selects from
-- this view, and the view simply has no price or cost column to leak. RLS on the
-- base table blocks the direct route independently.

create view driver_jobs
with (security_invoker = true)
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
  j.created_at,
  j.updated_at
from jobs j
join customers c on c.id = j.customer_id
join job_types jt on jt.id = j.job_type_id;

comment on view driver_jobs is
  'What a driver may see of a job. Contains no price, cost, contribution or margin column — the protection is structural, not a filter someone could forget to apply. internal_notes is also absent.';

-- --- Reference data ----------------------------------------------------------
-- Readable by any signed-in user, and by the public site for active rows only.

alter table industries enable row level security;
alter table job_types enable row level security;
alter table service_areas enable row level security;
alter table industries force row level security;
alter table job_types force row level security;
alter table service_areas force row level security;

create policy industries_select_authenticated on industries
  for select using (current_app_user_id() is not null);
create policy industries_write_partner on industries
  for all using (is_partner()) with check (is_partner());

create policy job_types_select_authenticated on job_types
  for select using (current_app_user_id() is not null);
create policy job_types_write_partner on job_types
  for all using (is_partner()) with check (is_partner());

create policy service_areas_select_authenticated on service_areas
  for select using (current_app_user_id() is not null);
create policy service_areas_select_public on service_areas
  for select to anon using (active);
create policy service_areas_write_partner on service_areas
  for all using (is_partner()) with check (is_partner());

-- --- Customers: partners only ------------------------------------------------
-- A driver has no policy on any customer table, so a driver reading them gets
-- zero rows. Customer names reach the driver only through driver_jobs, for the
-- single job they are assigned to.

alter table customers enable row level security;
alter table customer_contacts enable row level security;
alter table customer_locations enable row level security;
alter table customer_notes enable row level security;
alter table customers force row level security;
alter table customer_contacts force row level security;
alter table customer_locations force row level security;
alter table customer_notes force row level security;

create policy customers_partner on customers
  for all using (is_partner()) with check (is_partner());
create policy customer_contacts_partner on customer_contacts
  for all using (is_partner()) with check (is_partner());
create policy customer_locations_partner on customer_locations
  for all using (is_partner()) with check (is_partner());
create policy customer_notes_partner on customer_notes
  for all using (is_partner()) with check (is_partner());

-- --- Vehicles ----------------------------------------------------------------

alter table vehicles enable row level security;
alter table vehicle_status_history enable row level security;
alter table vehicles force row level security;
alter table vehicle_status_history force row level security;

create policy vehicles_partner on vehicles
  for all using (is_partner()) with check (is_partner());

-- A driver sees the vehicle they are currently assigned to, and no other.
create policy vehicles_select_own on vehicles
  for select using (
    is_driver() and exists (
      select 1 from drivers d
      where d.user_id = current_app_user_id() and d.current_vehicle_id = vehicles.id
    )
  );

create policy vehicle_status_history_partner on vehicle_status_history
  for all using (is_partner()) with check (is_partner());

-- --- Jobs --------------------------------------------------------------------

alter table jobs enable row level security;
alter table job_stops enable row level security;
alter table mileage_logs enable row level security;
alter table job_requests enable row level security;
alter table jobs force row level security;
alter table job_stops force row level security;
alter table mileage_logs force row level security;
alter table job_requests force row level security;

create policy jobs_partner on jobs
  for all using (is_partner()) with check (is_partner());

-- A driver sees only jobs assigned to them. The financial columns on those rows
-- are still present in the table, which is why the driver application reads
-- driver_jobs instead; this policy stops them reaching anyone else's work.
create policy jobs_select_assigned on jobs
  for select using (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

-- A driver may advance their own job. The state machine trigger decides which
-- transitions are legal; this decides whose job they may touch.
create policy jobs_update_assigned on jobs
  for update using (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  ) with check (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

create policy job_stops_partner on job_stops
  for all using (is_partner()) with check (is_partner());

create policy job_stops_driver on job_stops
  for select using (
    is_driver() and job_id in (
      select j.id from jobs j
      join drivers d on d.id = j.driver_id
      where d.user_id = current_app_user_id()
    )
  );

create policy job_stops_update_driver on job_stops
  for update using (
    is_driver() and job_id in (
      select j.id from jobs j
      join drivers d on d.id = j.driver_id
      where d.user_id = current_app_user_id()
    )
  ) with check (
    is_driver() and job_id in (
      select j.id from jobs j
      join drivers d on d.id = j.driver_id
      where d.user_id = current_app_user_id()
    )
  );

create policy mileage_logs_partner on mileage_logs
  for all using (is_partner()) with check (is_partner());

create policy mileage_logs_driver_own on mileage_logs
  for select using (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

create policy mileage_logs_driver_insert on mileage_logs
  for insert with check (
    is_driver() and driver_id in (
      select d.id from drivers d where d.user_id = current_app_user_id()
    )
  );

create policy job_requests_partner on job_requests
  for all using (is_partner()) with check (is_partner());

-- --- Job financial columns are not writable by a driver ----------------------
-- Same reasoning as the drivers table in Phase 2: partners and drivers share the
-- `authenticated` database role, so a column GRANT cannot distinguish them.

create or replace function enforce_driver_job_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if is_partner() then
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

create trigger jobs_restrict_driver_update
  before update on jobs
  for each row execute function enforce_driver_job_update_columns();

-- --- Audit log: readable by partners, writable by nobody ---------------------

alter table audit_logs enable row level security;
alter table audit_logs force row level security;

create policy audit_logs_select_partner on audit_logs
  for select using (is_partner());

-- Deliberately no INSERT, UPDATE or DELETE policy. Rows arrive only through
-- SECURITY DEFINER triggers, so the log cannot be written directly or edited.

-- --- Grants ------------------------------------------------------------------

revoke all on
  industries, job_types, service_areas,
  customers, customer_contacts, customer_locations, customer_notes,
  vehicles, vehicle_status_history,
  jobs, job_stops, mileage_logs, job_requests,
  audit_logs, job_status_transitions
from anon, authenticated;

grant select on job_status_transitions to authenticated;
grant select on service_areas to anon;

grant select, insert, update, delete on
  industries, job_types, service_areas,
  customers, customer_contacts, customer_locations, customer_notes,
  vehicles, jobs, job_stops, mileage_logs, job_requests
to authenticated;

grant select, insert on vehicle_status_history to authenticated;
grant select on audit_logs to authenticated;
grant select on driver_jobs to authenticated;
