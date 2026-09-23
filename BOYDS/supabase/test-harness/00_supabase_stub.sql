-- =============================================================================
-- LOCAL TEST HARNESS — NOT a BOYD'S migration. Never applied to a real database.
--
-- Recreates the parts of a hosted Supabase database that BOYD'S migrations and
-- policies depend on, so the real migrations run unmodified against plain
-- PostgreSQL and row level security is tested rather than assumed.
--
-- An earlier, simpler version of this file applied migrations as a SUPERUSER
-- and granted nothing by default. Hosted Supabase does neither, and both
-- differences hide real production failures:
--
--   * Migrations on Supabase run as `postgres`, which is NOT a superuser. A
--     superuser bypasses every policy, so SECURITY DEFINER functions and
--     owner-permission views could appear to work here and fail there.
--
--   * Supabase sets DEFAULT PRIVILEGES so that every table, view, sequence and
--     function created in `public` is granted to anon, authenticated and
--     service_role. A table or view a migration forgets to revoke is readable
--     by the public website's role in production. Without the same defaults
--     here, the tests would never notice.
--
--   * Supabase provides a `storage` schema with row level security already on
--     `storage.objects`. With no policies, every upload made with a user's
--     session is refused. Without the schema here, nothing tests that.
--
--   * PostgREST (v10 onward) passes the signed-in user as the JSON setting
--     `request.jwt.claims`, not `request.jwt.claim.sub`. auth.uid() below is
--     Supabase's own definition, and the test sessions set only the JSON form,
--     so any SQL that read the old setting directly would fail here as it
--     would in production.
--
-- ASSUMPTIONS ABOUT HOSTED SUPABASE, stated so they can be checked:
--
--   A1. The `postgres` role is NOSUPERUSER with CREATEROLE, CREATEDB and
--       BYPASSRLS. BOYD'S depends on BYPASSRLS: tables use FORCE ROW LEVEL
--       SECURITY, and SECURITY DEFINER trigger functions (audit, notifications)
--       and two owner-permission views run as the owner. The deployment
--       preflight (scripts/preflight-production.sql) checks this on the real
--       project before any migration is applied, and stops if it is false.
--   A2. `postgres` is a member of the role that owns storage.objects, so it
--       may CREATE POLICY there (Supabase documents policy creation on
--       storage.objects from the SQL editor and migrations).
--   A3. pgcrypto is preinstalled in the `extensions` schema, and the `postgres`
--       role's search_path is "$user", public, extensions.
--
-- The emulated `postgres` role is named `supabase_postgres` here, because the
-- local cluster's own bootstrap superuser is already called `postgres`.
-- =============================================================================

-- --- Roles -------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit createrole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
    create role supabase_storage_admin nologin noinherit createrole;
  end if;
  -- A1: hosted Supabase's `postgres`. Not a superuser.
  if not exists (select 1 from pg_roles where rolname = 'supabase_postgres') then
    create role supabase_postgres login nosuperuser createrole createdb bypassrls;
  end if;
end
$$;

-- A2: postgres may manage policies on storage tables.
grant supabase_storage_admin to supabase_postgres;

-- The migrating role can act as the API roles, as on Supabase.
grant anon, authenticated, service_role to supabase_postgres;

-- --- Database and public schema ----------------------------------------------

do $$
begin
  execute format('grant create, connect, temporary on database %I to supabase_postgres',
                 current_database());
end
$$;

grant usage, create on schema public to supabase_postgres;
grant usage on schema public to anon, authenticated, service_role;

-- --- Extensions (A3) ---------------------------------------------------------

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role, supabase_postgres;
create extension if not exists pgcrypto with schema extensions;

alter role supabase_postgres set search_path = "$user", public, extensions;

-- --- Default privileges: the hosted Supabase behaviour ------------------------
--
-- Everything the migrating role creates in `public` is granted to the three API
-- roles. BOYD'S migrations must revoke what the public must not reach; the
-- tests prove that they do.

alter default privileges for role supabase_postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role supabase_postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role supabase_postgres in schema public
  grant all on functions to anon, authenticated, service_role;

-- --- auth --------------------------------------------------------------------

create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, supabase_postgres;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);
alter table auth.users owner to supabase_auth_admin;
grant all on auth.users to supabase_postgres, service_role;

-- Supabase's own definition: the legacy setting first, then the JSON claims
-- PostgREST actually sets today.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;
alter function auth.uid() owner to supabase_auth_admin;
grant execute on function auth.uid() to anon, authenticated, service_role, supabase_postgres;

-- --- storage -----------------------------------------------------------------

create schema if not exists storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role, supabase_postgres;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata         jsonb,
  path_tokens      text[] generated always as (string_to_array(name, '/')) stored,
  version          text,
  user_metadata    jsonb,
  unique (bucket_id, name)
);

alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects owner to supabase_storage_admin;
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

grant all on storage.buckets, storage.objects
  to anon, authenticated, service_role, supabase_postgres;

-- Supabase's helper: every folder segment of an object name, without the file.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;
alter function storage.foldername(text) owner to supabase_storage_admin;
grant execute on function storage.foldername(text)
  to anon, authenticated, service_role, supabase_postgres;
