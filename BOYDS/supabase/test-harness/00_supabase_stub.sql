-- =============================================================================
-- LOCAL TEST HARNESS — NOT a BOYD'S migration. Never applied to a real database.
--
-- Supabase provides the `auth` schema, the `auth.uid()` function and the
-- `anon` / `authenticated` / `service_role` database roles. This file recreates
-- just enough of them for the real migrations in supabase/migrations/ to run
-- unmodified against a plain PostgreSQL instance, so BOYD'S row level security
-- can be tested for real rather than assumed.
--
-- The migrations themselves are never altered to accommodate testing.
-- =============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase sets request.jwt.claim.sub on each authenticated request. auth.uid()
-- reads it. The test harness sets the same setting, so policies behave here
-- exactly as they do in production.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
