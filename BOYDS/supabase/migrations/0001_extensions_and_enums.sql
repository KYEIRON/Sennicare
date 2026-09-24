-- =============================================================================
-- BOYD'S Logistics LLC — 0001 extensions and enumerated types
--
-- Enumerations are Postgres enum types rather than text with a check
-- constraint, so an illegal value cannot be stored by any code path.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email

-- --- Identity ----------------------------------------------------------------

create type user_role as enum ('PARTNER', 'DRIVER', 'ADMIN');

create type user_status as enum ('ACTIVE', 'INVITED', 'SUSPENDED', 'INACTIVE');

-- --- Shared timestamp trigger ------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function set_updated_at is
  'Maintains updated_at in the database so it cannot drift when a write takes an unusual code path.';
