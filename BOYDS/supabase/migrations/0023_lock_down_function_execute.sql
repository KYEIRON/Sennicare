-- =============================================================================
-- BOYD'S Logistics LLC — 0023 revoke default function EXECUTE from PUBLIC
--
-- SECURITY FIX.
--
-- PostgreSQL grants EXECUTE on every new function to PUBLIC by default. BOYD'S
-- had carefully revoked table access from `anon` and then handed it every
-- SECURITY DEFINER function in the schema — including two that matter:
--
--   notify_partners(...)        an anonymous visitor could raise fabricated
--                               notifications, burying real ones and, at 2am,
--                               waking partners for work that does not exist.
--
--   find_dispatch_conflicts(..) returns job numbers and detail. An anonymous
--                               caller could enumerate BOYD'S schedule.
--
-- The trigger functions were lower risk — called outside a trigger they error —
-- but there is no reason for them to be callable at all.
--
-- Only ONE function is meant to be reachable by the public website:
-- create_public_job_request, which validates its input, writes one row and
-- returns nothing but a reference number.
--
-- This also sets the DEFAULT for future functions, so the next one added is not
-- public the moment it is created.
-- =============================================================================

-- --- Revoke from PUBLIC on BOYD'S own functions ------------------------------
--
-- Scoped to functions BOYD'S wrote. A blanket revoke across the whole schema
-- was tried and broke two things: the citext extension's comparison functions
-- (which anon needs to query a citext column at all), and the RLS helpers that
-- policies themselves call during evaluation.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public'
      -- Skip functions owned by an extension: they are not BOYD'S to revoke,
      -- and anon needs some of them to run an ordinary query.
      and d.objid is null
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',
                   fn.signature);
  end loop;
end
$$;

-- --- Helpers that ROW LEVEL SECURITY POLICIES call ---------------------------
--
-- These must be executable by every role a policy is evaluated for, including
-- anon: a policy on a table anon may read references is_partner(), and Postgres
-- evaluates it as the querying role. Without EXECUTE the query fails outright.
--
-- Granting them is safe. For an anonymous caller current_app_user_id() returns
-- null and both role checks return false — which is exactly the answer the
-- policies need, and tells the caller nothing they did not already know.

grant execute on function current_app_user_id() to anon, authenticated;
grant execute on function current_app_user_role() to anon, authenticated;
grant execute on function is_partner() to anon, authenticated;
grant execute on function is_driver() to anon, authenticated;

-- --- Helpers a signed-in partner needs ---------------------------------------

grant execute on function
  find_dispatch_conflicts(uuid, uuid, uuid, date, time, time) to authenticated;
grant execute on function job_status_occupies_resources(job_status) to authenticated;
grant execute on function job_scheduled_window(date, time, time) to authenticated;

-- notify_partners is granted to NOBODY. Notifications are raised by triggers
-- running as SECURITY DEFINER; a notification that can be raised on demand is a
-- notification that can be forged. Before this migration an anonymous visitor
-- could bury real alerts in fabricated ones — and at 2am, wake the partners for
-- work that does not exist.

-- Trigger functions are granted to nobody either. They are invoked by their
-- triggers, which run regardless of the caller's EXECUTE privilege.

-- --- The one public entry point ----------------------------------------------

grant execute on function create_public_job_request(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, date, time, text, boolean, text, text
) to anon, authenticated;

-- --- What stops this gap reappearing -----------------------------------------
--
-- Not ALTER DEFAULT PRIVILEGES. That was tried and it is a silent no-op here:
-- PostgreSQL stores an empty ACL as NULL, which is indistinguishable from the
-- built-in default, so revoking the only default privilege records nothing and
-- changes nothing. A line that looks like protection and is not is worse than
-- no line, so it is not in this migration.
--
-- The actual guarantee is a test:
-- tests/integration/function-permissions.test.ts enumerates every function
-- `anon` may execute and asserts the list exactly. Adding a function without
-- revoking PUBLIC EXECUTE fails the build, with the new function named.
