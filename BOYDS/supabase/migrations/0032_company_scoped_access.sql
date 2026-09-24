-- =============================================================================
-- 0032 — Access is scoped to the signed-in person's company (Phase 2, M2)
--
-- 0029 gave every record a company and made cross-company references
-- impossible. Row level security still asked only "is this person a partner?"
-- — so a partner of one company would have seen every company's records.
--
-- 1. Every company table gets one RESTRICTIVE policy: the row's company must be
--    the signed-in person's. Restrictive policies are ANDed with the existing
--    permissive ones, so every rule that already held (partner-only, a
--    driver's own jobs, a person's own notifications) still holds, and now
--    only within their company. One rule per table, generated from the
--    catalogue, rather than 58 hand-edited policies that could each be missed.
-- 2. The public role reads no table at all. Its reads of job_types and
--    service_areas could not say which company's were meant, and nothing in
--    the website uses them (the site's own content is static).
-- 3. Stored files: a partner reaches a file only if the record its path names
--    belongs to their company.
-- 4. Elevated-rights functions that looked across the whole database now look
--    only within a company: the dispatch conflict check, and "the last active
--    admin".
-- =============================================================================

-- --- 1. One company per session, on every company table -----------------------------

do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relname not in ('organisations', 'organisation_counters')
      and exists (select 1 from pg_attribute a
                   where a.attrelid = c.oid and a.attname = 'organisation_id'
                     and not a.attisdropped)
    order by 1
  loop
    -- (select current_org_id()) is evaluated once per query, not per row.
    execute format(
      'create policy %I on %I as restrictive for all to authenticated
         using (organisation_id = (select current_org_id()))
         with check (organisation_id = (select current_org_id()))',
      t || '_same_company', t
    );
  end loop;
end
$$;

-- A person always reaches their OWN row, whatever their status. A suspended
-- person belongs to no company (current_org_id() is null), but the app must
-- still read their row to say "this account is not active" rather than the
-- misleading "those details were not recognised". The permissive policies
-- decide what else they see: nothing.
alter policy users_same_company on users
  using (organisation_id = (select current_org_id()) or auth_user_id = (select auth.uid()))
  with check (organisation_id = (select current_org_id()));

-- --- 2. The public reads nothing ----------------------------------------------------

drop policy job_types_select_public on job_types;
drop policy service_areas_select_public on service_areas;
revoke select on job_types, service_areas from anon;

-- --- 3. Stored files belong to the company of the record they are filed under ------
--
-- Paths are <entity_table>/<entity_id>/<file> (src/integrations/storage). The
-- company is the entity's. A path that names no known record has no company,
-- and no partner reaches it.

create or replace function storage_object_company(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  found uuid;
begin
  if array_length(parts, 1) is distinct from 3
     or parts[1] not in ('jobs', 'job_stops', 'vehicles', 'customers', 'job_expenses', 'incidents')
     or parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return null;
  end if;

  execute format('select organisation_id from %I where id = $1', parts[1])
    into found using parts[2]::uuid;
  return found;
end;
$$;

comment on function storage_object_company is
  'The company a stored file belongs to: that of the record its path names. Null for any other path.';

revoke all on function storage_object_company(text) from public, anon;
grant execute on function storage_object_company(text) to authenticated;

drop policy boyds_documents_partner on storage.objects;
create policy boyds_documents_partner
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'boyds-documents' and is_partner()
    and storage_object_company(name) = current_org_id()
  )
  with check (
    bucket_id = 'boyds-documents' and is_partner()
    and storage_object_company(name) = current_org_id()
  );

-- The driver policies are already confined to the driver's own assigned jobs,
-- which are in the driver's company.

-- --- 4a. The dispatch check looks only within the caller's company ------------------
--
-- A partner calls this directly. Given another company's van or driver id, it
-- used to answer with that company's job numbers. Now, for a signed-in caller,
-- it looks only at their own company. With no session (a migration, a
-- maintenance script) it is unrestricted — and even then a van's jobs are all
-- in the van's company (composite keys, 0029).

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
  ),
  scope as (
    select auth.uid() is null as unrestricted, current_org_id() as org
  )
  -- Vehicle already committed in an overlapping window
  select
    'VEHICLE_DOUBLE_BOOKED'::text,
    j.id,
    j.job_number,
    format('Vehicle already committed to %s at that time', j.job_number)
  from jobs j, window_under_test wut, scope s
  where p_vehicle_id is not null
    and (s.unrestricted or j.organisation_id = s.org)
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
  from jobs j, window_under_test wut, scope s
  where p_driver_id is not null
    and (s.unrestricted or j.organisation_id = s.org)
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
  from vehicles v, scope s
  where v.id = p_vehicle_id
    and (s.unrestricted or v.organisation_id = s.org)
    and (not v.active or v.status in ('MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'))

  union all

  -- Driver not in a state that can take work
  select
    'DRIVER_UNAVAILABLE'::text,
    null::uuid,
    null::text,
    format('Driver is %s / %s', d.status, d.availability)
  from drivers d, scope s
  where d.id = p_driver_id
    and (s.unrestricted or d.organisation_id = s.org)
    and (not d.active or d.status <> 'ACTIVE' or d.availability = 'UNAVAILABLE');
$$;

-- --- 4b. Every company keeps at least one admin -------------------------------------

create or replace function enforce_user_management_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  acting uuid := current_app_user_id();
begin
  if tg_op = 'UPDATE' then
    -- Nobody changes their own role or status, whatever screen or query they
    -- use. Self-promotion and self-lockout are both closed here.
    if acting is not null and old.id = acting
       and (new.role is distinct from old.role or new.status is distinct from old.status)
    then
      raise exception 'Nobody can change their own role or status. Ask another admin.'
        using errcode = 'insufficient_privilege';
    end if;

    -- A person belongs to one company for good. Moving them would carry their
    -- sign-in into another company's records.
    if new.organisation_id is distinct from old.organisation_id then
      raise exception 'A person cannot be moved to another company. Add them there instead.'
        using errcode = 'insufficient_privilege';
    end if;

    -- A linked sign-in account belongs to this person for good. Re-pointing it
    -- at another account would hand one person's access to someone else.
    if old.auth_user_id is not null
       and new.auth_user_id is distinct from old.auth_user_id
    then
      raise exception 'A linked sign-in account cannot be changed or removed. Deactivate this person and add them again instead.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Once someone can sign in, their email is their sign-in. Changing it here
    -- would not change it in the authentication system, and the two would
    -- silently disagree.
    if old.auth_user_id is not null and new.email is distinct from old.email then
      raise exception 'The email of a person who can already sign in cannot be changed here.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Every company must always have someone who can manage its people.
    if old.role = 'ADMIN' and old.status = 'ACTIVE'
       and (new.role <> 'ADMIN' or new.status <> 'ACTIVE')
       and not exists (
         select 1 from users u
          where u.organisation_id = old.organisation_id
            and u.role = 'ADMIN' and u.status = 'ACTIVE' and u.id <> old.id
       )
    then
      raise exception 'This is the last active admin. Make someone else an admin first.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;
