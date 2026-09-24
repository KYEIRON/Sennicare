-- =============================================================================
-- BOYD'S Logistics LLC — 0025 close Supabase's default grants
--
-- SECURITY FIX. Found by testing against a harness that reproduces hosted
-- Supabase's DEFAULT PRIVILEGES, which grant ALL on every table, view,
-- sequence and function created in `public` to anon, authenticated and
-- service_role. Earlier migrations revoked those grants on every TABLE, but
-- not on the two VIEWS or on the audit sequence, and so on a real project:
--
--   driver_vehicle_maintenance  An anonymous visitor could INSERT maintenance
--                               records against any vehicle, with one request
--                               to /rest/v1/driver_vehicle_maintenance. The view
--                               is owner-permission and auto-updatable, so the
--                               row bypassed row level security entirely.
--                               Maintenance records feed vehicle cost per mile
--                               and therefore every profitability figure. A
--                               signed-in driver could do the same for any van.
--
--   driver_jobs                 Held INSERT/UPDATE/DELETE grants for anon and
--                               authenticated. Not exploitable — the view joins
--                               tables and is not updatable — but the grants
--                               were wrong and one edit away from mattering.
--
--   audit_logs_id_seq           anon and authenticated held USAGE and UPDATE,
--                               so could call setval(). Resetting it makes every
--                               audited write collide with an existing id and
--                               fail: jobs, quotes, invoices, customers,
--                               expenses. Demonstrated against the test harness.
--                               setval is not exposed by Supabase's REST API, so
--                               this is defence in depth rather than an open
--                               door — but the grant was wrong.
--
-- Nothing here removes an intended grant. The public website's reads of
-- job_types and service_areas, granted explicitly with their own policies, are
-- untouched. tests/integration/supabase-privileges.test.ts asserts the exact
-- set of relations the public role can reach.
-- =============================================================================

-- --- The views: read-only, and only for signed-in users ----------------------

revoke all on driver_jobs, driver_vehicle_maintenance from public, anon, authenticated;
grant select on driver_jobs, driver_vehicle_maintenance to authenticated;

-- --- Sequences: driven by SECURITY DEFINER triggers, used by nobody else ------

revoke all on sequence audit_logs_id_seq from public, anon, authenticated;

-- --- Future objects: closed by default ---------------------------------------
--
-- Every BOYD'S migration grants what it intends explicitly. With these, a table,
-- view, sequence or function added later without its own grants is unreachable
-- from the API rather than open to the public — failing closed, not open.
--
-- These revokes DO take effect on Supabase, unlike the PUBLIC revoke rejected
-- in 0023: Supabase records explicit default grants to anon and authenticated,
-- so there is a stored entry here to remove. The privileges test proves it by
-- creating an object afterwards and checking what anon holds on it.
--
-- service_role is left alone. It bypasses row level security, is used only on
-- the server, and is never exposed to a browser.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
