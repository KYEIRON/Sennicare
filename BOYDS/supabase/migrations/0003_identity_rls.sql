-- =============================================================================
-- BOYD'S Logistics LLC — 0003 row level security for identity
--
-- RLS is the real authorisation boundary. Server-side guards and hidden UI sit
-- above it as convenience and defence in depth; this file is what holds if the
-- application has a bug.
--
-- Rule: RLS is enabled on EVERY table, with no exceptions, and no policy is
-- written more permissively than the business rule requires.
-- =============================================================================

-- --- Helper functions --------------------------------------------------------
-- SECURITY DEFINER so a policy can read `users` without recursing through the
-- policies on `users` itself. Each is STABLE, so Postgres evaluates it once per
-- statement rather than once per row.

create or replace function current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select u.id
  from users u
  where u.auth_user_id = auth.uid()
    and u.status = 'ACTIVE'
  limit 1;
$$;

comment on function current_app_user_id is
  'The BOYD''S user row for the current session, or null. Only ACTIVE users resolve, so suspending an account revokes access immediately at the database level.';

create or replace function current_app_user_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select u.role
  from users u
  where u.auth_user_id = auth.uid()
    and u.status = 'ACTIVE'
  limit 1;
$$;

create or replace function is_partner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(current_app_user_role() in ('PARTNER', 'ADMIN'), false);
$$;

comment on function is_partner is
  'True for PARTNER and ADMIN. Defaults to false when no session resolves — an unknown caller is never a partner.';

create or replace function is_driver()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(current_app_user_role() = 'DRIVER', false);
$$;

-- --- users -------------------------------------------------------------------

alter table users enable row level security;
alter table users force row level security;

-- A driver can read their own record and nothing else. In particular a driver
-- cannot enumerate the people in the business.
create policy users_select_self on users
  for select
  using (auth_user_id = auth.uid());

create policy users_select_partner on users
  for select
  using (is_partner());

-- Only partners may create or change user records. Note there is deliberately
-- NO self-update policy: a user cannot change their own role, which would
-- otherwise be a direct route to privilege escalation.
create policy users_insert_partner on users
  for insert
  with check (is_partner());

create policy users_update_partner on users
  for update
  using (is_partner())
  with check (is_partner());

-- No delete policy at all. User records are never deleted — they are suspended.
-- Deleting one would orphan audited history.

-- --- partners ----------------------------------------------------------------

alter table partners enable row level security;
alter table partners force row level security;

create policy partners_select_partner on partners
  for select
  using (is_partner());

create policy partners_write_partner on partners
  for all
  using (is_partner())
  with check (is_partner());

-- Drivers get no policy on partners, so a driver reading this table sees zero
-- rows. Partner information is not visible to the driver surface.

-- --- drivers -----------------------------------------------------------------

alter table drivers enable row level security;
alter table drivers force row level security;

create policy drivers_select_self on drivers
  for select
  using (user_id = current_app_user_id());

create policy drivers_select_partner on drivers
  for select
  using (is_partner());

-- A driver may maintain their own contact phone. They may NOT alter their own
-- licence details or active status — those are operational records a partner
-- owns. Enforced by the trigger below, because partners and drivers share the
-- `authenticated` database role, so a column-level GRANT cannot tell them apart
-- and would block partners too.
create policy drivers_update_self on drivers
  for update
  using (user_id = current_app_user_id())
  with check (user_id = current_app_user_id());

create policy drivers_write_partner on drivers
  for all
  using (is_partner())
  with check (is_partner());

-- --- Grants ------------------------------------------------------------------
-- RLS filters rows; grants control tables and columns. Both are needed: a
-- policy cannot stop a driver writing a column they hold UPDATE on.

revoke all on users, partners, drivers from anon, authenticated;

grant select, insert, update on users to authenticated;
grant select, insert, update, delete on partners to authenticated;
grant select, insert, update, delete on drivers to authenticated;

-- The anonymous (public website) role gets nothing here at all. The public
-- surface has no business reading any identity table.

-- --- Column protection on drivers -------------------------------------------
-- The policy above decides WHICH ROW a driver may update. This trigger decides
-- WHICH COLUMNS. A column-level GRANT cannot do this job: partners and drivers
-- both authenticate as the `authenticated` role, so a grant narrow enough to
-- restrain a driver would equally restrain a partner.

create or replace function enforce_driver_self_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Partners and admins may change anything on a driver record.
  if is_partner() then
    return new;
  end if;

  -- Anyone else updating a driver row may change only their contact phone.
  if new.id             is distinct from old.id
     or new.user_id        is distinct from old.user_id
     or new.license_number is distinct from old.license_number
     or new.license_state  is distinct from old.license_state
     or new.license_expiry is distinct from old.license_expiry
     or new.active         is distinct from old.active
     or new.created_at     is distinct from old.created_at
  then
    raise exception
      'A driver may only update their own phone number. Licence details and active status are maintained by a partner.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger drivers_restrict_self_update
  before update on drivers
  for each row execute function enforce_driver_self_update_columns();
