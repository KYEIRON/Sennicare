-- =============================================================================
-- BOYD'S — production PREFLIGHT. Read-only. Run BEFORE any migration.
--
-- One SELECT statement: it changes nothing, and runs the same in psql, the
-- Supabase SQL editor, or the Supabase MCP. Every row is PASS, INFO or STOP.
--
--   ANY `STOP` ROW MEANS: DO NOT APPLY MIGRATIONS. Resolve it first.
--
-- It checks the assumptions the migrations were tested under (see the header
-- of supabase/test-harness/00_supabase_stub.sql), on the real project, so a
-- wrong assumption stops the deploy instead of surfacing as a production fault.
-- =============================================================================

with
  me as (
    select rolname, rolsuper, rolbypassrls
    from pg_roles
    where rolname = current_user
  ),
  -- Catalog lookups rather than to_regclass(): a role without USAGE on a schema
  -- gets an error from to_regclass, and a preflight that crashes is a worse
  -- answer than a preflight that says STOP.
  rel as (
    select n.nspname, c.relname, c.relowner, c.oid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
  ),
  fn as (
    select n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
  ),
  history as (
    select exists (
      select 1 from rel
       where nspname = 'supabase_migrations' and relname = 'schema_migrations'
    )
    and has_schema_privilege('supabase_migrations', 'USAGE') as present
  ),
  applied as (
    select case
      when (select present from history)
      then (xpath('/row/v/text()', query_to_xml(
              'select coalesce(max(version), ''none'') as v, count(*) as c
                 from supabase_migrations.schema_migrations', false, true, '')))[1]::text
      else 'none'
    end as last_version
  ),
  boyds_tables as (
    select count(*) as n
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relname in ('users', 'jobs', 'customers', 'vehicles', 'invoices')
  )

select * from (
  select 1 as ord, 'connected as' as "check", 'INFO' as result,
         current_user || ' on database ' || current_database() as detail

  union all
  select 2, 'postgres version', 
         case when current_setting('server_version_num')::int >= 150000 then 'PASS' else 'STOP' end,
         current_setting('server_version') ||
         ' (15 or later required: the driver views use security_invoker)'

  union all
  select 3, 'migrating role bypasses row level security',
         case when (select rolsuper or rolbypassrls from me) then 'PASS' else 'STOP' end,
         'superuser=' || (select rolsuper from me)::text ||
         ' bypassrls=' || (select rolbypassrls from me)::text ||
         ' — BOYD''S forces RLS on every table; the audit and notification triggers ' ||
         'and the two driver views run as this role and need BYPASSRLS'

  union all
  select 4, 'supabase auth present',
         case when exists (select 1 from rel where nspname = 'auth' and relname = 'users')
               and exists (select 1 from fn where nspname = 'auth' and proname = 'uid')
               and has_schema_privilege('auth', 'USAGE')
              then 'PASS' else 'STOP' end,
         'auth.users and auth.uid() — users are linked to auth.users by foreign key'

  union all
  select 5, 'supabase storage present',
         case when exists (select 1 from rel where nspname = 'storage' and relname = 'objects')
               and exists (select 1 from rel where nspname = 'storage' and relname = 'buckets')
               and exists (select 1 from fn where nspname = 'storage' and proname = 'foldername')
               and has_schema_privilege('storage', 'USAGE')
              then 'PASS' else 'STOP' end,
         'storage.objects, storage.buckets, storage.foldername() — needed by migration 0026'

  union all
  select 6, 'may create policies on storage.objects',
         case
           when not exists (select 1 from rel where nspname = 'storage' and relname = 'objects')
             then 'STOP'
           when (select rolsuper from me)
             or pg_has_role(current_user,
                  (select relowner from rel where nspname = 'storage' and relname = 'objects'),
                  'MEMBER')
           then 'PASS' else 'STOP' end,
         'owner of storage.objects is ' || coalesce(
           (select pg_get_userbyid(relowner) from rel
             where nspname = 'storage' and relname = 'objects'), 'missing')

  union all
  select 7, 'api roles present',
         case when (select count(*) from pg_roles
                     where rolname in ('anon', 'authenticated', 'service_role')) = 3
              then 'PASS' else 'STOP' end,
         'anon, authenticated, service_role'

  union all
  select 8, 'citext extension available',
         case when exists (select 1 from pg_available_extensions where name = 'citext')
              then 'PASS' else 'STOP' end,
         'case-insensitive email addresses'

  union all
  select 9, 'gen_random_uuid available',
         case when to_regprocedure('gen_random_uuid()') is not null then 'PASS' else 'STOP' end,
         'every primary key'

  union all
  select 10, 'supabase default grants in place', 'INFO',
         case when exists (
                select 1 from pg_default_acl
                 where defaclrole = (select oid from pg_roles where rolname = current_user)
                   and defaclnamespace = 'public'::regnamespace
                   and defaclacl::text like '%anon=%')
              then 'anon is in the default grants, as the tests assume; migration 0025 closes them'
              else 'anon is not in the default grants (already closed by 0025, or never set)' end

  union all
  select 11, 'database state',
         case
           when (select n from boyds_tables) = 0 then 'PASS'
           when (select last_version from applied) <> 'none' then 'INFO'
           else 'STOP'
         end,
         case
           when (select n from boyds_tables) = 0
             then 'clean — no BOYD''S tables yet; all migrations will be applied'
           when (select last_version from applied) <> 'none'
             then 'already migrated through ' || (select last_version from applied) ||
                  '; only newer migrations will be applied'
           else 'BOYD''S tables exist but there is no migration history — ' ||
                'the schema was changed by hand. Do not push over it; investigate.'
         end
) checks
order by ord;
