-- =============================================================================
-- 0029 — organisations: the company boundary (Phase 2, milestone 1)
--
-- The system becomes able to hold more than one logistics company, with
-- BOYD'S Logistics LLC as the first. See docs/PHASE_2_ARCHITECTURE.md §3.
--
-- What this migration does:
--
--   1. An `organisations` table, and BOYD'S as its first row. Every existing
--      record is BOYD'S, so every existing row is assigned to it.
--
--   2. `organisation_id` on 31 of the 33 business tables, required. The two
--      that stay global: `job_status_transitions` (the job state machine is the
--      product's rules, not a company's data) and `industries` (a shared,
--      read-only catalogue).
--
--   3. A row gets its company WITHOUT the application having to say so — and
--      without ever guessing:
--        * a child row inherits from its parent (a stop from its job, a
--          payment from its invoice, a driver record from its person);
--        * a top-level row (a customer, a vehicle) takes the company of the
--          signed-in person creating it;
--        * if neither exists, the insert is REFUSED.
--      There is deliberately no "use the only company" fallback: it would be
--      correct today and a cross-company leak the day a second company exists.
--
--   4. Composite foreign keys on EVERY reference between business tables:
--      (parent_id, organisation_id) → parent (id, organisation_id). A job in one
--      company cannot reference another company's customer, vehicle, driver,
--      contract or user — the database refuses the row, whatever the code does.
--      They are generated from the catalogue so none can be missed, and
--      tests/integration/organisations.test.ts asserts every single-column
--      reference between business tables has its composite twin.
--
--   5. Reference numbers and vehicle codes become unique PER COMPANY.
--
-- What this migration deliberately does NOT do yet (milestone 2):
--   row level security by company, and the review of every elevated-rights
--   function. With one company in the database, behaviour is unchanged; with
--   two, milestone 2 must be in place first. verify-production.sql checks the
--   company boundary is complete.
-- =============================================================================

-- --- organisations ---------------------------------------------------------------

create table organisations (
  id                uuid primary key default gen_random_uuid(),
  slug              citext not null unique,
  name              text not null,
  status            text not null default 'ACTIVE',
  -- US only at first (Phase 2 decision 7). The columns exist so a later
  -- market is a data change, but the checks refuse anything else for now.
  timezone          text not null default 'America/New_York',
  currency          text not null default 'USD',
  distance_unit     text not null default 'MILES',
  fuel_unit         text not null default 'GALLONS',
  provenance        data_provenance not null default 'REAL',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint organisations_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint organisations_name_present check (length(btrim(name)) > 0),
  constraint organisations_status_known check (status in ('ACTIVE', 'SUSPENDED')),
  constraint organisations_us_only check (
    currency = 'USD' and distance_unit = 'MILES' and fuel_unit = 'GALLONS'
    and timezone like 'America/%'
  )
);

comment on table organisations is
  'The companies using the system. BOYD''S Logistics LLC is the first. Every business row belongs to exactly one.';

create trigger organisations_set_updated_at
  before update on organisations
  for each row execute function set_updated_at();

-- BOYD'S: the business this system was built for, and the owner of every row
-- that exists today.
insert into organisations (slug, name) values ('boyds', 'BOYD''S Logistics LLC');

-- --- organisation_id on every business table --------------------------------------

do $$
declare
  t text;
  boyds uuid := (select id from organisations where slug = 'boyds');
begin
  foreach t in array array[
    'users', 'partners', 'drivers',
    'customers', 'customer_contacts', 'customer_locations', 'customer_notes',
    'vehicles', 'vehicle_status_history',
    'job_types', 'service_areas',
    'jobs', 'job_stops', 'mileage_logs', 'job_requests',
    'audit_logs', 'notifications',
    'documents', 'job_expenses', 'fuel_transactions',
    'vehicle_cost_entries', 'maintenance_records',
    'leads', 'pricing_rules', 'quotes', 'quote_items',
    'contracts', 'invoices', 'invoice_lines', 'payments',
    'incidents'
  ] loop
    execute format('alter table %I add column organisation_id uuid references organisations (id) on delete restrict', t);
    execute format('update %I set organisation_id = $1', t) using boyds;
    execute format('alter table %I alter column organisation_id set not null', t);
    execute format('create index %I on %I (organisation_id)', t || '_organisation_idx', t);
    -- The target of the composite foreign keys below.
    execute format('alter table %I add constraint %I unique (id, organisation_id)',
                   t, t || '_id_organisation_key');
  end loop;
end
$$;

-- --- The signed-in person's company ----------------------------------------------

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select u.organisation_id
  from users u
  where u.auth_user_id = auth.uid()
    and u.status = 'ACTIVE'
  limit 1;
$$;

comment on function current_org_id is
  'The company of the signed-in, ACTIVE person. Null for anyone else — an unknown caller belongs to no company.';

-- --- A new row's company: inherited, or the creator's, or refused ------------------
--
-- Arguments name where to look, in order: pairs of (column, parent table). The
-- special parent '@entity_table' means "the table named in this row's
-- entity_table column" (documents). If no parent yields a company, the
-- signed-in person's company is used. If there is none, the insert fails.
--
-- A value already supplied is kept; the composite foreign keys then prove it
-- matches the parent.

create or replace function assign_organisation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  i int := 0;
  col text;
  parent text;
  parent_id uuid;
  found uuid;
begin
  if new.organisation_id is not null then
    return new;
  end if;

  while i < tg_nargs loop
    col := tg_argv[i];
    parent := tg_argv[i + 1];
    parent_id := (to_jsonb(new) ->> col)::uuid;

    if parent_id is not null then
      if parent = '@entity_table' then
        parent := to_jsonb(new) ->> 'entity_table';
      end if;
      execute format('select organisation_id from %I where id = $1', parent)
        into found using parent_id;
      if found is not null then
        new.organisation_id := found;
        return new;
      end if;
    end if;

    i := i + 2;
  end loop;

  new.organisation_id := current_org_id();

  if new.organisation_id is null then
    raise exception 'A % record needs a company, and none could be determined.', tg_table_name
      using errcode = 'not_null_violation';
  end if;

  return new;
end;
$$;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      -- top-level records: the creator's company
      ('users',                  ''),
      ('customers',              ''),
      ('vehicles',               ''),
      ('job_types',              ''),
      ('service_areas',          ''),
      -- children: inherit from the parent
      ('partners',               '''user_id'', ''users'''),
      ('drivers',                '''user_id'', ''users'''),
      ('customer_contacts',      '''customer_id'', ''customers'''),
      ('customer_locations',     '''customer_id'', ''customers'''),
      ('customer_notes',         '''customer_id'', ''customers'''),
      ('vehicle_status_history', '''vehicle_id'', ''vehicles'''),
      ('jobs',                   '''customer_id'', ''customers'''),
      ('job_stops',              '''job_id'', ''jobs'''),
      ('mileage_logs',           '''vehicle_id'', ''vehicles'''),
      ('job_requests',           '''customer_id'', ''customers'''),
      ('audit_logs',             '''user_id'', ''users'''),
      ('notifications',          '''recipient_user_id'', ''users'''),
      ('documents',              '''entity_id'', ''@entity_table'''),
      ('job_expenses',           '''job_id'', ''jobs'', ''vehicle_id'', ''vehicles'', ''driver_id'', ''drivers'''),
      ('fuel_transactions',      '''vehicle_id'', ''vehicles'''),
      ('vehicle_cost_entries',   '''vehicle_id'', ''vehicles'''),
      ('maintenance_records',    '''vehicle_id'', ''vehicles'''),
      ('leads',                  '''customer_id'', ''customers'''),
      ('pricing_rules',          '''job_type_id'', ''job_types'''),
      ('quotes',                 '''job_type_id'', ''job_types'''),
      ('quote_items',            '''quote_id'', ''quotes'''),
      ('contracts',              '''customer_id'', ''customers'''),
      ('invoices',               '''customer_id'', ''customers'''),
      ('invoice_lines',          '''invoice_id'', ''invoices'''),
      ('payments',               '''invoice_id'', ''invoices'''),
      ('incidents',              '''vehicle_id'', ''vehicles''')
    ) as s(tbl, args)
  loop
    execute format(
      'create trigger %I before insert on %I for each row execute function assign_organisation(%s)',
      spec.tbl || '_assign_organisation', spec.tbl, spec.args
    );
  end loop;
end
$$;

-- --- Composite foreign keys: no reference may cross a company ------------------------
--
-- Generated from the catalogue: every single-column foreign key from one
-- company-scoped table to another gets a composite twin. The original keys
-- stay, keeping their ON DELETE behaviour; MATCH SIMPLE means a null
-- reference is still allowed, exactly as before.

do $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass::text as child,
           a.attname as col,
           c.confrelid::regclass::text as parent
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
      and a.attname <> 'organisation_id'
      and exists (select 1 from pg_attribute x
                   where x.attrelid = c.conrelid and x.attname = 'organisation_id' and not x.attisdropped)
      and exists (select 1 from pg_attribute y
                   where y.attrelid = c.confrelid and y.attname = 'organisation_id' and not y.attisdropped)
  loop
    execute format(
      'alter table %I add constraint %I foreign key (%I, organisation_id) references %I (id, organisation_id)',
      fk.child, left(fk.child || '_' || fk.col || '_same_org_fkey', 63), fk.col, fk.parent
    );
  end loop;
end
$$;

-- --- Reference numbers unique per company, not across companies ---------------------
--
-- Two companies each have a job BJ-2026-0001; within one company, numbers stay
-- unique. users.email and users.auth_user_id stay globally unique: one company
-- per sign-in (Phase 2 decision 1).

do $$
declare
  target record;
  con record;
begin
  for target in
    select * from (values
      ('customers', 'customer_number'), ('jobs', 'job_number'),
      ('leads', 'lead_number'), ('quotes', 'quote_number'),
      ('invoices', 'invoice_number'), ('contracts', 'contract_number'),
      ('job_requests', 'request_number'), ('incidents', 'incident_number'),
      ('vehicles', 'vehicle_code'), ('job_types', 'code')
    ) as t(tbl, col)
  loop
    for con in
      select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.conrelid = target.tbl::regclass
        and c.contype = 'u'
        and array_length(c.conkey, 1) = 1
        and a.attname = target.col
    loop
      execute format('alter table %I drop constraint %I', target.tbl, con.conname);
    end loop;

    execute format('alter table %I add constraint %I unique (organisation_id, %I)',
                   target.tbl, target.tbl || '_' || target.col || '_per_org_key', target.col);
  end loop;
end
$$;

-- --- The audit trail records the company of what changed ----------------------------
--
-- Redefined only to set organisation_id from the row being audited; the
-- logic is otherwise identical to 0011. Every audited table carries the column.

create or replace function write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  audited text[] := audited_columns_for(tg_table_name);
  col text;
  old_json jsonb;
  new_json jsonb;
  old_val text;
  new_val text;
  changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (organisation_id, user_id, action, entity_table, entity_id, new_value, changed)
    values (
      new.organisation_id,
      current_app_user_id(),
      'CREATED',
      tg_table_name,
      new.id,
      null,
      to_jsonb(new) - 'created_at' - 'updated_at'
    );
    return new;
  end if;

  old_json := to_jsonb(old);
  new_json := to_jsonb(new);

  foreach col in array audited loop
    old_val := old_json ->> col;
    new_val := new_json ->> col;

    if old_val is distinct from new_val then
      changes := changes || jsonb_build_object(col, jsonb_build_object('from', old_val, 'to', new_val));

      insert into audit_logs (organisation_id, user_id, action, entity_table, entity_id, field, old_value, new_value)
      values (
        new.organisation_id,
        current_app_user_id(),
        case
          when col = 'status' then 'STATUS_CHANGED'
          when col in ('vehicle_id') then 'VEHICLE_ASSIGNMENT_CHANGED'
          when col in ('driver_id') then 'DRIVER_ASSIGNMENT_CHANGED'
          when col like '%price%' then 'PRICE_CHANGED'
          when col like '%cost%' then 'COST_RECORDED'
          when col like '%miles%' then 'MILEAGE_RECORDED'
          when col = 'cancellation_reason' then 'CANCELLED'
          else 'UPDATED'
        end,
        tg_table_name,
        new.id,
        col,
        old_val,
        new_val
      );
    end if;
  end loop;

  return new;
end;
$$;

-- --- organisations: readable by its own members, written by nobody through the API ---
--
-- Creating a company is a platform-owner action (Phase 2 decision 2), done
-- deliberately with a script, not from the application.

alter table organisations enable row level security;
alter table organisations force row level security;

create policy organisations_select_own on organisations
  for select
  using (id = current_org_id());

revoke all on organisations from public, anon, authenticated;
grant select on organisations to authenticated;

-- --- Function EXECUTE (see 0023) -----------------------------------------------------

revoke all on function current_org_id() from public, anon;
grant execute on function current_org_id() to authenticated;

revoke all on function assign_organisation() from public, anon, authenticated;
