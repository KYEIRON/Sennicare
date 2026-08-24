-- =============================================================================
-- BOYD'S Logistics LLC — 0002 identity: users, partners, drivers
--
-- Ronald and Moh are PARTNERS with different operational responsibilities, not
-- an employer and an employee. Moh additionally holds a driver record. The two
-- are independent: being a partner does not imply driving, and driving does not
-- imply partnership.
-- =============================================================================

-- --- users -------------------------------------------------------------------
-- One row per person who can sign in. Mirrors auth.users, which Supabase owns.

create table users (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid unique references auth.users (id) on delete restrict,
  email            citext not null unique,
  first_name       text not null,
  last_name        text,
  phone            text,
  role             user_role not null,
  status           user_status not null default 'INVITED',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_login_at    timestamptz,

  constraint users_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint users_first_name_present check (length(btrim(first_name)) > 0)
);

comment on table users is
  'People who can sign in to BOYD''S. auth_user_id links to Supabase Auth; it is nullable only so a person can be recorded before their sign-in account exists.';
comment on column users.role is
  'PARTNER, DRIVER or ADMIN. Authorisation derives from this and is enforced in RLS, not in the interface.';

create index users_role_idx on users (role) where status = 'ACTIVE';
create index users_auth_user_id_idx on users (auth_user_id);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- --- partners ----------------------------------------------------------------

create table partners (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references users (id) on delete restrict,
  name             text not null,
  role_title       text not null,
  responsibilities text[] not null default '{}',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint partners_name_present check (length(btrim(name)) > 0)
);

comment on table partners is
  'Business partners in BOYD''S Logistics LLC. A partner is not an employee. Partner compensation treatment is deliberately NOT recorded here — it is an accounting matter kept out of operational profitability. See docs/DECISIONS.md D-011.';

create trigger partners_set_updated_at
  before update on partners
  for each row execute function set_updated_at();

-- --- drivers -----------------------------------------------------------------

create table drivers (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references users (id) on delete restrict,
  license_number     text,
  license_state      text,
  license_expiry     date,
  phone              text,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint drivers_license_state_shape
    check (license_state is null or license_state ~ '^[A-Z]{2}$')
);

comment on table drivers is
  'Operational driver records. License fields stay null until BOYD''S supplies the real values — nothing here is invented.';

create trigger drivers_set_updated_at
  before update on drivers
  for each row execute function set_updated_at();
