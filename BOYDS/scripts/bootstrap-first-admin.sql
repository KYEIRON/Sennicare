-- =============================================================================
-- BOYD'S — create the FIRST admin. Run ONCE, on a freshly deployed project.
--
-- Everyone after the first admin is added from the Team screen. This script
-- exists only because the first admin has nobody to invite them.
--
-- BEFORE RUNNING:
--   1. Supabase → Authentication → Users → Add user → Create new user.
--      Enter the admin's real email and a strong password; tick
--      "Auto Confirm User". (Or send them an invite from the same screen.)
--   2. Edit the four values below. Nothing else.
--
-- Run it in the Supabase SQL editor, or through the Supabase MCP.
--
-- It refuses to run:
--   * if the values below have not been edited;
--   * if an active admin already exists — use the Team screen instead;
--   * if no sign-in account exists yet for that email (step 1);
--   * if that sign-in account is already linked to someone.
-- It changes nothing unless every check passes.
-- =============================================================================

do $$
declare
  -- ---- EDIT THESE ------------------------------------------------------------
  v_email         text := 'REPLACE-WITH-EMAIL';
  v_first_name    text := 'REPLACE-WITH-FIRST-NAME';
  v_last_name     text := null;            -- or 'Surname'
  v_partner_title text := null;            -- their role in the business, if a partner
  -- ----------------------------------------------------------------------------
  v_auth_id uuid;
  v_person  uuid;
begin
  if v_email like 'REPLACE-%' or v_first_name like 'REPLACE-%' then
    raise exception 'Edit the values at the top of the script first. Nothing has been changed.';
  end if;

  if exists (select 1 from public.users where role = 'ADMIN' and status = 'ACTIVE') then
    raise exception 'An active admin already exists. Add further people from the Team screen. Nothing has been changed.';
  end if;

  select id into v_auth_id from auth.users where lower(email) = lower(v_email);
  if v_auth_id is null then
    raise exception 'No sign-in account exists for % yet. Create it first: Supabase → Authentication → Users → Add user. Nothing has been changed.', v_email;
  end if;

  if exists (select 1 from public.users where auth_user_id = v_auth_id) then
    raise exception 'That sign-in account is already linked to someone on the team. Nothing has been changed.';
  end if;

  -- They may already be on the team without a sign-in (added before it existed).
  select id into v_person from public.users where email = v_email::citext;

  if v_person is null then
    insert into public.users (auth_user_id, email, first_name, last_name, role, status)
    values (v_auth_id, v_email, v_first_name, v_last_name, 'ADMIN', 'ACTIVE')
    returning id into v_person;
  else
    update public.users
       set auth_user_id = v_auth_id, role = 'ADMIN', status = 'ACTIVE'
     where id = v_person;
  end if;

  if v_partner_title is not null
     and not exists (select 1 from public.partners where user_id = v_person) then
    insert into public.partners (user_id, name, role_title)
    values (v_person, btrim(v_first_name || ' ' || coalesce(v_last_name, '')), v_partner_title);
  end if;

  raise notice 'Done. % is the first admin and can now sign in and manage the team.', v_email;
end
$$;

-- Confirms the result. One row: the admin just created.
select first_name, email, role, status,
       auth_user_id is not null as can_sign_in,
       exists (select 1 from public.partners p where p.user_id = u.id) as is_partner
  from public.users u
 where role = 'ADMIN' and status = 'ACTIVE';
