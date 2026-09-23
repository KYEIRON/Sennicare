-- =============================================================================
-- BOYD'S — production VERIFICATION. Read-only. Run AFTER migrations.
--
-- Holds the live project to the same standard the integration tests hold the
-- test database to. One SELECT statement; changes nothing. Every row is PASS,
-- INFO or STOP.
--
--   ANY `STOP` ROW MEANS: DO NOT PUT THIS PROJECT INTO SERVICE.
--
-- The expected lists below are copied from the tests that assert them, so if
-- a migration changes one of these on purpose, change both together:
--   anon relations ....... tests/integration/supabase-privileges.test.ts
--   anon functions ....... tests/integration/function-permissions.test.ts
--   storage .............. tests/integration/document-storage.test.ts
-- =============================================================================

with
  public_tables as (
    select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  ),
  anon_relations as (
    select c.relname || ':' || p.privilege as grant_
    from pg_class c
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(privilege)
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'v', 'm', 'p', 'f')
      and has_table_privilege('anon', c.oid, p.privilege)
  ),
  anon_functions as (
    select p.proname
    from pg_proc p
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where p.pronamespace = 'public'::regnamespace
      and d.objid is null
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  -- Every table with a provenance column, and how many DEMO rows it holds.
  -- Illustrative data must never reach production (CLAUDE.md §6).
  demo_rows as (
    select c.table_name,
           (xpath('/row/n/text()', query_to_xml(
              format('select count(*) as n from public.%I where provenance = ''DEMO''',
                     c.table_name), false, true, '')))[1]::text::int as n
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'provenance'
      and c.table_name in (select relname from public_tables)
  )

select * from (
  select 1 as ord, 'migration history' as "check",
         case when (select count(*) from supabase_migrations.schema_migrations) >= 27
               and (select max(version) from supabase_migrations.schema_migrations) >= '0027'
              then 'PASS' else 'STOP' end as result,
         (select count(*) || ' recorded, latest ' || coalesce(max(version), 'none')
            from supabase_migrations.schema_migrations) as detail

  union all
  select 2, 'row level security on every table',
         case when (select count(*) from public_tables where not relrowsecurity) = 0
              then 'PASS' else 'STOP' end,
         (select count(*) from public_tables) || ' tables; without RLS: ' ||
         coalesce((select string_agg(relname, ', ') from public_tables where not relrowsecurity), 'none')

  union all
  select 3, 'row level security forced on every table',
         case when (select count(*) from public_tables where not relforcerowsecurity) = 0
              then 'PASS' else 'STOP' end,
         'not forced: ' ||
         coalesce((select string_agg(relname, ', ') from public_tables where not relforcerowsecurity), 'none')

  union all
  select 4, 'public role reaches only the website reference tables',
         case when (select coalesce(string_agg(grant_, ',' order by grant_), '') from anon_relations)
                   = 'job_types:SELECT,service_areas:SELECT'
              then 'PASS' else 'STOP' end,
         coalesce((select string_agg(grant_, ', ' order by grant_) from anon_relations), 'nothing')

  union all
  select 5, 'public role can execute exactly one entry point and the RLS helpers',
         case when (select coalesce(string_agg(proname, ',' order by proname), '') from anon_functions)
                   = 'create_public_job_request,current_app_user_id,current_app_user_role,is_driver,is_partner'
              then 'PASS' else 'STOP' end,
         coalesce((select string_agg(proname, ', ' order by proname) from anon_functions), 'nothing')

  union all
  select 6, 'no api role can write through a view',
         case when not exists (
                select 1 from pg_class c
                 where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
                   and (has_table_privilege('anon', c.oid, 'insert')
                     or has_table_privilege('anon', c.oid, 'update')
                     or has_table_privilege('authenticated', c.oid, 'insert')
                     or has_table_privilege('authenticated', c.oid, 'update')
                     or has_table_privilege('authenticated', c.oid, 'delete')))
              then 'PASS' else 'STOP' end,
         'driver_jobs and driver_vehicle_maintenance are read-only'

  union all
  select 7, 'no api role holds a sequence',
         case when not exists (
                select 1 from pg_class c
                 where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
                   and (has_sequence_privilege('anon', c.oid, 'usage')
                     or has_sequence_privilege('anon', c.oid, 'update')
                     or has_sequence_privilege('authenticated', c.oid, 'usage')
                     or has_sequence_privilege('authenticated', c.oid, 'update')))
              then 'PASS' else 'STOP' end,
         'audit_logs_id_seq, incident_number_seq'

  union all
  select 8, 'document bucket exists and is private',
         case when exists (select 1 from storage.buckets
                            where id = 'boyds-documents' and public = false)
              then 'PASS' else 'STOP' end,
         coalesce((select 'public=' || public::text || ', limit=' || coalesce(file_size_limit::text, 'none')
                     from storage.buckets where id = 'boyds-documents'), 'bucket missing')

  union all
  select 9, 'document storage policies present',
         case when (select count(*) from pg_policies
                     where schemaname = 'storage' and tablename = 'objects'
                       and policyname in ('boyds_documents_partner',
                                          'boyds_documents_driver_upload',
                                          'boyds_documents_driver_read')) = 3
              then 'PASS' else 'STOP' end,
         (select count(*) from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname like 'boyds_documents_%') || ' of 3'

  union all
  select 10, 'no DEMO data in production',
         case when coalesce((select sum(n) from demo_rows), 0) = 0 then 'PASS' else 'STOP' end,
         coalesce((select string_agg(table_name || '=' || n, ', ') from demo_rows where n > 0),
                  'none across ' || (select count(*) from demo_rows) || ' tables')

  union all
  select 13, 'only an admin can create or change a person',
         case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_insert_admin')
               and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_admin')
               and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'partners_write_admin')
               and not exists (select 1 from pg_policies where schemaname = 'public'
                                 and tablename in ('users', 'partners')
                                 and policyname in ('users_insert_partner', 'users_update_partner', 'partners_write_partner'))
              then 'PASS' else 'STOP' end,
         'a partner cannot add people or promote anyone, themselves included (0027)'

  union all
  select 14, 'identity guardrails enforced',
         case when exists (select 1 from pg_trigger
                            where tgrelid = 'public.users'::regclass
                              and tgname = 'users_management_rules'
                              and tgenabled = 'O')
              then 'PASS' else 'STOP' end,
         'no self role/status change; last admin kept; sign-in cannot be re-pointed'

  union all
  select 15, 'identity changes are audited',
         case when (select count(*) from pg_trigger
                     where tgenabled = 'O'
                       and (tgrelid, tgname) in (('public.users'::regclass, 'users_audit'),
                                                 ('public.partners'::regclass, 'partners_audit'),
                                                 ('public.drivers'::regclass, 'drivers_audit'))) = 3
               and 'role' = any (public.audited_columns_for('users'))
               and 'description' = any (public.audited_columns_for('incidents'))
              then 'PASS' else 'STOP' end,
         'role, status and incident corrections are recorded, with who and from-what-to-what'

  union all
  select 16, 'first sign-in activation is available to signed-in users only',
         case when to_regprocedure('public.record_my_sign_in()') is not null
               and has_function_privilege('authenticated', 'public.record_my_sign_in()', 'execute')
               and not has_function_privilege('anon', 'public.record_my_sign_in()', 'execute')
              then 'PASS' else 'STOP' end,
         'record_my_sign_in(): never reactivates a deactivated account'

  union all
  select 11, 'people and admins', 'INFO',
         (select count(*) from public.users where role = 'ADMIN' and status = 'ACTIVE') ||
         ' active admin(s); ' ||
         (select count(*) from public.users) || ' people on the team; ' ||
         (select count(*) from public.users where email is null) || ' waiting for an email. ' ||
         case when not exists (select 1 from public.users where role = 'ADMIN' and status = 'ACTIVE')
              then 'No admin yet: run scripts/bootstrap-first-admin.sql once.'
              else 'Further people are managed from the Team screen.' end

  union all
  select 12, 'pricing policy', 'INFO',
         (select count(*) from public.pricing_rules where active) ||
         ' active pricing rules. None means minimum contribution and target margin ' ||
         'read NOT CONFIGURED — correct until BOYD''S decides them.'
) checks
order by ord;
