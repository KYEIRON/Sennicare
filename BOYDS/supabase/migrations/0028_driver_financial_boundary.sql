-- =============================================================================
-- BOYD'S Logistics LLC — 0028 a driver never reads a price or a cost
--
-- SECURITY FIX, found on the live project. Business rule 28: a driver can never
-- read a price, a cost, a contribution or a margin — CLAUDE.md §8 adds "not
-- through a direct database query".
--
-- The driver application reads jobs through driver_jobs, which has no financial
-- column. But two policies still let a driver's own session select base-table
-- rows directly, and a signed-in driver holds a token that can query the API:
--
--   * jobs_select_assigned  — every column of their jobs, quoted and won price
--                             and every estimated and actual cost included;
--   * vehicles_select_own   — their van's purchase price, insurance cost and
--                             insurance policy number.
--
-- Both are removed. What a driver legitimately needs is served instead by:
--
--   * driver_jobs / driver_vehicle_maintenance (unchanged): the columns a
--     driver needs, filtered to their own work inside the view;
--   * driver_advance_job() and driver_record_mileage(): the only two writes the
--     driver application makes to a job. They check the job is assigned to the
--     caller, then update it with every existing trigger still in force — the
--     state machine, the driver column guard (0014) and the audit trail;
--   * my_assigned_job_ids(): "the jobs assigned to me", for the policies on
--     documents, job stops and storage that previously looked that up by
--     reading jobs under the driver's own permissions.
--
-- ALSO CLOSED: the driver insert policies on job_expenses, fuel_transactions,
-- mileage_logs and incidents checked that the record was the driver's own but
-- not that the job it names was theirs (rule 30: "for their own jobs"). A
-- hand-made request could file a cost against another driver's job.
-- =============================================================================

-- --- "The jobs assigned to me" -----------------------------------------------
--
-- Runs as the owner so it can read jobs without granting the caller any access
-- to the table itself. It returns ids only — never a column of the job.

create function my_assigned_job_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select j.id
  from jobs j
  join drivers d on d.id = j.driver_id
  where d.user_id = current_app_user_id();
$$;

revoke all on function my_assigned_job_ids() from public, anon;
grant execute on function my_assigned_job_ids() to authenticated;

-- --- No direct read of a job or a vehicle by a driver ------------------------

drop policy jobs_select_assigned on jobs;
drop policy jobs_update_assigned on jobs;
drop policy vehicles_select_own on vehicles;

-- --- The two writes a driver makes to a job ----------------------------------
--
-- The UPDATE inside each function still runs every trigger on jobs. is_driver()
-- reads the caller's own sign-in, not the function owner, so the driver column
-- guard applies exactly as it did to a direct update.

create function driver_advance_job(p_job_id uuid, p_to_status job_status)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not is_driver() then
    raise exception 'Only a driver may advance a job this way.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_job_id is null or p_job_id not in (select my_assigned_job_ids()) then
    raise exception 'That job is not assigned to you.'
      using errcode = 'insufficient_privilege';
  end if;

  update jobs set status = p_to_status where id = p_job_id;
end;
$$;

create function driver_record_mileage(
  p_job_id uuid,
  p_start_odometer_tenths integer,
  p_end_odometer_tenths integer,
  p_empty_miles_tenths integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  total_tenths integer;
begin
  if not is_driver() then
    raise exception 'Only a driver may record mileage this way.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_job_id is null or p_job_id not in (select my_assigned_job_ids()) then
    raise exception 'That job is not assigned to you.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_start_odometer_tenths is null or p_end_odometer_tenths is null
     or p_start_odometer_tenths < 0 then
    raise exception 'Enter both odometer readings.' using errcode = 'check_violation';
  end if;

  if p_end_odometer_tenths < p_start_odometer_tenths then
    raise exception 'The end reading cannot be lower than the start reading.'
      using errcode = 'check_violation';
  end if;

  total_tenths := p_end_odometer_tenths - p_start_odometer_tenths;

  if coalesce(p_empty_miles_tenths, 0) < 0 or coalesce(p_empty_miles_tenths, 0) > total_tenths then
    raise exception 'Empty miles must be between zero and the total miles driven.'
      using errcode = 'check_violation';
  end if;

  update jobs
     set start_odometer_tenths = p_start_odometer_tenths,
         end_odometer_tenths   = p_end_odometer_tenths,
         actual_miles_tenths   = total_tenths,
         loaded_miles_tenths   = total_tenths - coalesce(p_empty_miles_tenths, 0),
         empty_miles_tenths    = coalesce(p_empty_miles_tenths, 0)
   where id = p_job_id;
end;
$$;

revoke all on function driver_advance_job(uuid, job_status) from public, anon;
revoke all on function driver_record_mileage(uuid, integer, integer, integer) from public, anon;
grant execute on function driver_advance_job(uuid, job_status) to authenticated;
grant execute on function driver_record_mileage(uuid, integer, integer, integer) to authenticated;

-- --- Policies that looked up "my jobs" by reading jobs -----------------------
--
-- Same rules as before; only the lookup changes, so they keep working now that
-- a driver cannot read jobs directly.

drop policy job_stops_driver on job_stops;
create policy job_stops_driver on job_stops
  for select using (is_driver() and job_id in (select my_assigned_job_ids()));

drop policy job_stops_update_driver on job_stops;
create policy job_stops_update_driver on job_stops
  for update
  using (is_driver() and job_id in (select my_assigned_job_ids()))
  with check (is_driver() and job_id in (select my_assigned_job_ids()));

drop policy documents_driver_own_job on documents;
create policy documents_driver_own_job on documents
  for select using (
    is_driver()
    and entity_table = 'jobs'
    and entity_id in (select my_assigned_job_ids())
  );

drop policy documents_driver_insert on documents;
create policy documents_driver_insert on documents
  for insert with check (
    is_driver()
    and entity_table in ('jobs', 'job_expenses')
    and (entity_table = 'job_expenses' or entity_id in (select my_assigned_job_ids()))
  );

drop policy boyds_documents_driver_upload on storage.objects;
create policy boyds_documents_driver_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'boyds-documents'
    and is_driver()
    and (storage.foldername(name))[1] = 'jobs'
    and (storage.foldername(name))[2] in (select id::text from my_assigned_job_ids() as id)
  );

drop policy boyds_documents_driver_read on storage.objects;
create policy boyds_documents_driver_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'boyds-documents'
    and is_driver()
    and (storage.foldername(name))[1] = 'jobs'
    and (storage.foldername(name))[2] in (select id::text from my_assigned_job_ids() as id)
  );

-- --- Field records name only the driver's own jobs ---------------------------

drop policy job_expenses_driver_insert on job_expenses;
create policy job_expenses_driver_insert on job_expenses
  for insert with check (
    is_driver()
    and driver_id in (select d.id from drivers d where d.user_id = current_app_user_id())
    and (job_id is null or job_id in (select my_assigned_job_ids()))
  );

drop policy fuel_driver_insert on fuel_transactions;
create policy fuel_driver_insert on fuel_transactions
  for insert with check (
    is_driver()
    and driver_id in (select d.id from drivers d where d.user_id = current_app_user_id())
    and (job_id is null or job_id in (select my_assigned_job_ids()))
  );

drop policy mileage_logs_driver_insert on mileage_logs;
create policy mileage_logs_driver_insert on mileage_logs
  for insert with check (
    is_driver()
    and driver_id in (select d.id from drivers d where d.user_id = current_app_user_id())
    and (job_id is null or job_id in (select my_assigned_job_ids()))
  );

drop policy incidents_driver_insert on incidents;
create policy incidents_driver_insert on incidents
  for insert with check (
    is_driver()
    and driver_id in (select d.id from drivers d where d.user_id = current_app_user_id())
    and (job_id is null or job_id in (select my_assigned_job_ids()))
  );
