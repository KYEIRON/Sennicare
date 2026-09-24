-- =============================================================================
-- BOYD'S Logistics LLC — 0027 user management
--
-- People are data, not code. Ronald, Moh and everyone who comes after them are
-- rows in `users`, added, invited, re-roled, deactivated and reactivated by an
-- ADMIN from the Team screen, without a code change or a developer.
--
-- This migration builds that on the existing identity model (0002, 0003). It
-- adds no parallel system, and it TIGHTENS security rather than relaxing it.
--
-- 1. Only an ADMIN may create or change a person, or a partner record.
--    Until now any PARTNER could update any users row — including their own
--    role. The application already reserved user management for ADMIN (the
--    `users.manage` capability); the database, the authoritative layer, did
--    not. A partner could have promoted themselves to ADMIN with one UPDATE.
--
-- 2. A person can be recorded before they have an email address, so a real
--    colleague — Moh — can exist with his partner and driver records while the
--    invitation waits for his real address. No placeholder address is ever
--    needed. The moment a sign-in account exists, an email is required.
--
-- 3. Guardrails no screen can bypass: nobody changes their own role or status;
--    the last active ADMIN cannot be demoted or deactivated; a linked sign-in
--    account cannot be re-pointed at a different person; nobody is ACTIVE
--    without a sign-in account.
--
-- 4. Every change to a person, partner or driver record is audited.
--
-- 5. First sign-in activates an invited account, through one narrow function.
--    A deactivated or suspended person cannot use it to reactivate themselves.
-- =============================================================================

-- --- is_admin() --------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(current_app_user_role() = 'ADMIN', false);
$$;

comment on function is_admin is
  'True only for an ACTIVE ADMIN. The one role that may manage people. Defaults to false with no session.';

-- --- users: an email only once there is something to sign in to --------------

alter table users alter column email drop not null;

alter table users add constraint users_signin_needs_email
  check (email is not null or auth_user_id is null);

alter table users add constraint users_active_needs_signin
  check (status <> 'ACTIVE' or auth_user_id is not null);

comment on column users.email is
  'Required once a sign-in account is linked. Null only for a person recorded before their real address is known — never a placeholder.';

-- --- users: only an ADMIN writes ---------------------------------------------

drop policy users_insert_partner on users;
drop policy users_update_partner on users;

create policy users_insert_admin on users
  for insert
  with check (is_admin());

create policy users_update_admin on users
  for update
  using (is_admin())
  with check (is_admin());

-- --- partners: only an ADMIN writes ------------------------------------------
-- Marking someone a business partner is an identity decision, not an
-- operational one. Partners can still READ partner records.

drop policy partners_write_partner on partners;

create policy partners_write_admin on partners
  for all
  using (is_admin())
  with check (is_admin());

-- drivers keep partner write access: licence details and the active flag are
-- operational records partners maintain (0003). Creating a driver record for a
-- person is covered by the same policy.

-- --- Guardrails ----------------------------------------------------------------

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

    -- The business must always have someone who can manage people.
    if old.role = 'ADMIN' and old.status = 'ACTIVE'
       and (new.role <> 'ADMIN' or new.status <> 'ACTIVE')
       and not exists (
         select 1 from users u
          where u.role = 'ADMIN' and u.status = 'ACTIVE' and u.id <> old.id
       )
    then
      raise exception 'This is the last active admin. Make someone else an admin first.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger users_management_rules
  before update on users
  for each row execute function enforce_user_management_rules();

-- --- Audit every identity change ---------------------------------------------
-- users and partners were not audited until now. A change of role is exactly
-- the kind of change the audit trail exists to record.

create trigger users_audit
  after insert or update on users
  for each row execute function write_audit_log();

create trigger partners_audit
  after insert or update on partners
  for each row execute function write_audit_log();

-- drivers has been audited since 0011.

-- The audit trigger records an UPDATE only for the columns listed per table,
-- and users, partners and incidents had no list — so a change of role, a
-- deactivation, or a correction to a driver's incident report was recorded as
-- nothing at all. (Inserts were always captured in full.) Redefined here with
-- those three added; every other table's list is unchanged from 0011.

create or replace function audited_columns_for(p_table text)
returns text[]
language sql
immutable
as $$
  select case p_table
    when 'jobs' then array[
      'status', 'quoted_price_cents', 'won_price_cents', 'vehicle_id', 'driver_id',
      'scheduled_date', 'scheduled_time', 'cancellation_reason',
      'fuel_cost_actual_cents', 'driver_cost_actual_cents', 'vehicle_cost_actual_cents',
      'toll_cost_actual_cents', 'parking_cost_actual_cents', 'other_cost_actual_cents',
      'actual_miles_tenths', 'loaded_miles_tenths', 'empty_miles_tenths'
    ]
    when 'customers' then array['customer_status', 'company_name', 'payment_terms_days']
    when 'vehicles' then array['status', 'active', 'current_odometer_tenths']
    when 'drivers' then array['status', 'availability', 'active', 'current_vehicle_id']
    when 'job_expenses' then array['amount_cents', 'category', 'job_id']
    when 'vehicle_cost_entries' then
      array['amount_cents', 'cost_line', 'included_in_cost_per_mile', 'effective_to']
    when 'quotes' then
      array['quoted_price_cents', 'status', 'below_minimum_override', 'valid_until']
    when 'leads' then array['stage', 'owner_user_id', 'lost_reason']
    when 'invoices' then array['status', 'total_cents', 'amount_paid_cents', 'due_date']
    when 'contracts' then array['status', 'agreed_rate_cents', 'end_date']
    when 'pricing_rules' then
      array['base_price_cents', 'per_mile_cents', 'target_margin_bps',
            'minimum_contribution_cents', 'active']
    -- New in 0027:
    when 'users' then
      array['role', 'status', 'email', 'auth_user_id', 'first_name', 'last_name']
    when 'partners' then array['name', 'role_title', 'active']
    when 'incidents' then array[
      'status', 'severity', 'incident_type', 'description', 'occurred_at',
      'location_description', 'anyone_injured', 'police_involved',
      'police_report_number', 'third_party_involved', 'third_party_details',
      'goods_affected', 'cost_cents', 'resolution_notes'
    ]
    else array[]::text[]
  end;
$$;

-- --- First sign-in ---------------------------------------------------------------
--
-- Called by the application after a successful sign-in, and after an invited
-- person sets their password. It does exactly two things, for the caller's own
-- row only:
--   * an INVITED account becomes ACTIVE — the person has proved they own the
--     sign-in account an admin linked to them;
--   * the sign-in time is stamped.
-- A SUSPENDED or INACTIVE account is returned unchanged. Reactivation is an
-- admin decision, never the user's own.
--
-- It replaces a direct UPDATE the sign-in page used to make, which silently did
-- nothing for drivers because only partners could update users rows.

create or replace function record_my_sign_in()
returns table (role user_role, status user_status)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
  update users u
     set status        = case when u.status = 'INVITED' then 'ACTIVE'::user_status else u.status end,
         last_login_at = case when u.status in ('INVITED', 'ACTIVE') then now() else u.last_login_at end
   where u.auth_user_id = auth.uid()
     and auth.uid() is not null
  returning u.role, u.status;
end;
$$;

comment on function record_my_sign_in is
  'Activates the caller''s own INVITED account on first sign-in and stamps the sign-in time. Never reactivates a SUSPENDED or INACTIVE account.';

-- --- Adding a person, all or nothing ---------------------------------------------
--
-- A person, their partner record and their driver record are created together
-- or not at all, so the Team screen can never leave someone half-added.
--
-- SECURITY INVOKER — deliberately. It runs with the caller's own rights, so
-- the same row level security that governs a direct insert decides here: only
-- an ADMIN can add a person or a partner record. It adds atomicity, not power.

create or replace function add_team_member(
  p_first_name    text,
  p_last_name     text,
  p_email         citext,
  p_role          user_role,
  p_partner_title text,
  p_is_driver     boolean
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  person_id uuid;
begin
  insert into users (first_name, last_name, email, role, status)
  values (p_first_name, nullif(btrim(p_last_name), ''), p_email, p_role, 'INVITED')
  returning id into person_id;

  if p_partner_title is not null and length(btrim(p_partner_title)) > 0 then
    insert into partners (user_id, name, role_title)
    values (person_id,
            btrim(p_first_name || ' ' || coalesce(nullif(btrim(p_last_name), ''), '')),
            btrim(p_partner_title));
  end if;

  if p_is_driver then
    insert into drivers (user_id) values (person_id);
  end if;

  return person_id;
end;
$$;

comment on function add_team_member is
  'Adds a person with optional partner and driver records in one transaction. SECURITY INVOKER: row level security decides, exactly as for a direct insert.';

-- --- Function EXECUTE ------------------------------------------------------------
-- See 0023. New functions are executable by PUBLIC until revoked.

revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

revoke all on function record_my_sign_in() from public, anon;
grant execute on function record_my_sign_in() to authenticated;

revoke all on function enforce_user_management_rules() from public, anon, authenticated;

revoke all on function add_team_member(text, text, citext, user_role, text, boolean) from public, anon;
grant execute on function add_team_member(text, text, citext, user_role, text, boolean) to authenticated;
