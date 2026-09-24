-- =============================================================================
-- 0030 — reference numbers per company (Phase 2, milestone 1)
--
-- Three problems with how reference numbers were made, fixed together:
--
--   1. RACES. Six numbers were made in the application by counting the table
--      and adding one, and job requests the same way in SQL. Two records
--      created at the same moment got the same number, and one of them failed
--      on the unique constraint.
--
--   2. LEAKS. With more than one company, counting the whole table would put
--      another company's volume into your numbers: create your first job and
--      receive BJ-2026-0412.
--
--   3. AMBIGUITY. Invoices and incident reports shared a format — both
--      BI-2026-0001 — so a number read out on the phone could be either.
--
-- Now: one counter row per company, per kind of record, per year, advanced by
-- a single atomic upsert (the row lock serialises concurrent callers). Each
-- company has its own prefix; BOYD'S keeps "B", so its existing numbers
-- continue unchanged. Incident reports take the code IR: BIR-2026-0001.
--
-- Counters are initialised from the numbers already issued, so nothing BOYD'S
-- has handed out can be issued again.
-- =============================================================================

-- --- Each company's prefix ---------------------------------------------------------

alter table organisations add column reference_prefix text;
update organisations set reference_prefix = 'B' where slug = 'boyds';
alter table organisations alter column reference_prefix set not null;
alter table organisations add constraint organisations_reference_prefix_shape
  check (reference_prefix ~ '^[A-Z]{1,3}$');

comment on column organisations.reference_prefix is
  'Starts every reference number the company issues: B for BOYD''S, so BJ-2026-0001 is a BOYD''S job.';

-- --- Counters ----------------------------------------------------------------------

create table organisation_counters (
  organisation_id uuid not null references organisations (id) on delete restrict,
  kind            text not null,
  period          integer not null,   -- the year, or 0 for numbers that do not reset
  last_value      integer not null,
  primary key (organisation_id, kind, period),
  constraint organisation_counters_kind_known check (
    kind in ('CUSTOMER', 'LEAD', 'JOB', 'QUOTE', 'INVOICE', 'CONTRACT', 'REQUEST', 'INCIDENT')
  ),
  constraint organisation_counters_positive check (last_value > 0)
);

comment on table organisation_counters is
  'The last reference number issued per company, kind and year. Written only by issue_reference_number().';

-- Nobody reads or writes this through the API. Only the issuing function does.
alter table organisation_counters enable row level security;
alter table organisation_counters force row level security;
revoke all on organisation_counters from public, anon, authenticated;

-- Carry on from what has already been issued. Only numbers in the system's
-- own format count; anything else (hand-entered, imported) is left alone.
--
-- A function, because it is needed twice: once here, and again after a backup
-- is restored (scripts/restore-database.sh), when the records come back but
-- the counters may be missing or behind. It only ever moves a counter FORWARD,
-- so running it again is always safe.
create or replace function sync_organisation_counters()
returns void
language sql
set search_path = public, pg_catalog
as $$
  insert into organisation_counters as c (organisation_id, kind, period, last_value)
  select organisation_id, kind, period, max(n)
  from (
    select organisation_id, 'CUSTOMER' as kind, 0 as period,
           (regexp_match(customer_number, '^[A-Z]{1,3}C-(\d+)$'))[1]::int as n
      from customers
    union all
    select organisation_id, 'LEAD', 0, (regexp_match(lead_number, '^[A-Z]{1,3}L-(\d+)$'))[1]::int
      from leads
    union all
    select organisation_id, 'JOB', (regexp_match(job_number, '^[A-Z]{1,3}J-(\d{4})-\d+$'))[1]::int,
           (regexp_match(job_number, '^[A-Z]{1,3}J-\d{4}-(\d+)$'))[1]::int
      from jobs
    union all
    select organisation_id, 'QUOTE', (regexp_match(quote_number, '^[A-Z]{1,3}Q-(\d{4})-\d+$'))[1]::int,
           (regexp_match(quote_number, '^[A-Z]{1,3}Q-\d{4}-(\d+)$'))[1]::int
      from quotes
    union all
    select organisation_id, 'INVOICE', (regexp_match(invoice_number, '^[A-Z]{1,3}I-(\d{4})-\d+$'))[1]::int,
           (regexp_match(invoice_number, '^[A-Z]{1,3}I-\d{4}-(\d+)$'))[1]::int
      from invoices
    union all
    select organisation_id, 'CONTRACT', (regexp_match(contract_number, '^[A-Z]{1,3}K-(\d{4})-\d+$'))[1]::int,
           (regexp_match(contract_number, '^[A-Z]{1,3}K-\d{4}-(\d+)$'))[1]::int
      from contracts
    union all
    select organisation_id, 'REQUEST', (regexp_match(request_number, '^[A-Z]{1,3}R-(\d{4})-\d+$'))[1]::int,
           (regexp_match(request_number, '^[A-Z]{1,3}R-\d{4}-(\d+)$'))[1]::int
      from job_requests
    union all
    -- Incidents: only the new BIR- format. Numbers from the old BI- sequence
    -- cannot collide with BIR- ones, so they do not move the counter.
    select organisation_id, 'INCIDENT', (regexp_match(incident_number, '^[A-Z]{1,3}IR-(\d{4})-\d+$'))[1]::int,
           (regexp_match(incident_number, '^[A-Z]{1,3}IR-\d{4}-(\d+)$'))[1]::int
      from incidents
  ) issued
  where n is not null and period is not null
  group by organisation_id, kind, period
  on conflict (organisation_id, kind, period)
    do update set last_value = greatest(c.last_value, excluded.last_value);
$$;

revoke all on function sync_organisation_counters() from public, anon, authenticated;

select sync_organisation_counters();

-- --- Issuing a number --------------------------------------------------------------

create or replace function issue_reference_number(p_organisation_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  org organisations;
  code text;
  yearly boolean;
  v_period integer;
  n integer;
begin
  select * into org from organisations where id = p_organisation_id;
  if not found then
    raise exception 'Unknown company.' using errcode = 'foreign_key_violation';
  end if;

  code := case p_kind
    when 'CUSTOMER' then 'C'
    when 'LEAD'     then 'L'
    when 'JOB'      then 'J'
    when 'QUOTE'    then 'Q'
    when 'INVOICE'  then 'I'
    when 'CONTRACT' then 'K'
    when 'REQUEST'  then 'R'
    when 'INCIDENT' then 'IR'
  end;
  if code is null then
    raise exception 'Unknown kind of reference number: %', p_kind using errcode = 'check_violation';
  end if;

  yearly := p_kind not in ('CUSTOMER', 'LEAD');
  -- The year in the company's own time zone: a job created at 8pm on
  -- 31 December in North Carolina belongs to that year, not the next.
  v_period := case when yearly
                 then extract(year from now() at time zone org.timezone)::integer
                 else 0 end;

  -- One atomic statement. Concurrent callers queue on the counter row, so no
  -- two ever receive the same number.
  insert into organisation_counters as c (organisation_id, kind, period, last_value)
  values (p_organisation_id, p_kind, v_period, 1)
  on conflict (organisation_id, kind, period)
    do update set last_value = c.last_value + 1
  returning c.last_value into n;

  return org.reference_prefix || code || '-'
      || case when yearly then v_period::text || '-' else '' end
      -- lpad would TRUNCATE a fifth digit (12345 → 1234) and reissue old
      -- numbers; past 9999 the number simply grows.
      || case when n < 10000 then lpad(n::text, 4, '0') else n::text end;
end;
$$;

comment on function issue_reference_number is
  'Issues the next reference number for a company. Atomic and per company: numbers never repeat and never reveal another company''s volume.';

-- What the application calls: the signed-in partner's own company, always.
create or replace function next_reference_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not is_partner() then
    raise exception 'Only a partner can create records that take a reference number.'
      using errcode = 'insufficient_privilege';
  end if;
  return issue_reference_number(current_org_id(), p_kind);
end;
$$;

-- --- Incident reports: numbered by company, with their own code ----------------------

create or replace function assign_incident_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.incident_number := issue_reference_number(new.organisation_id, 'INCIDENT');
  return new;
end;
$$;

-- Triggers of the same kind fire in name order. This one must run after
-- incidents_assign_organisation has set the company it numbers for.
drop trigger incidents_assign_number on incidents;
create trigger incidents_number_assign
  before insert on incidents
  for each row execute function assign_incident_number();

-- incident_number_seq is no longer used, but it stays: a backup taken before
-- this migration sets its value, and a restore of that backup must not fail
-- on a missing sequence. No API role can reach it (0024).
comment on sequence incident_number_seq is
  'Unused since 0030 (incidents are numbered per company). Kept so older backups restore.';

-- --- The public request form: told which company it is for ---------------------------
--
-- An anonymous visitor belongs to no company, so the form must say which one
-- it is the request form FOR — a public slug, set by each company's website or
-- hosted form link. An unknown or suspended company is refused rather than
-- routed anywhere.

drop function create_public_job_request(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, date, time, text, boolean, text, text
);

create or replace function create_public_job_request(
  p_organisation_slug text,
  p_company_name text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_pickup_address text,
  p_pickup_city text,
  p_pickup_state text,
  p_pickup_zip text,
  p_delivery_address text,
  p_delivery_city text,
  p_delivery_state text,
  p_delivery_zip text,
  p_description text,
  p_pickup_date date,
  p_pickup_time time,
  p_urgency text,
  p_is_recurring boolean,
  p_source text default 'WEBSITE',
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  org organisations;
  request_number text;
  after_hours boolean;
  local_hour integer;
begin
  select * into org
  from organisations
  where slug = p_organisation_slug::citext and status = 'ACTIVE';
  if not found then
    raise exception 'This request form is not available.' using errcode = 'check_violation';
  end if;

  -- Basic shape checks. A public endpoint takes nothing on trust.
  if length(btrim(coalesce(p_contact_name, ''))) = 0 then
    raise exception 'A contact name is required.' using errcode = 'check_violation';
  end if;

  if coalesce(p_contact_email, '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     and length(btrim(coalesce(p_contact_phone, ''))) = 0 then
    raise exception 'An email address or a phone number is required.'
      using errcode = 'check_violation';
  end if;

  if length(btrim(coalesce(p_pickup_address, ''))) = 0
     or length(btrim(coalesce(p_delivery_address, ''))) = 0 then
    raise exception 'A collection and a delivery address are required.'
      using errcode = 'check_violation';
  end if;

  -- After hours in the company's operating time zone, not the visitor's.
  local_hour := extract(hour from (now() at time zone org.timezone));
  after_hours := local_hour >= 18 or local_hour < 7;

  request_number := issue_reference_number(org.id, 'REQUEST');

  insert into job_requests (
    organisation_id,
    request_number, status, source,
    company_name, contact_name, contact_email, contact_phone,
    description,
    pickup_address, pickup_city, pickup_state, pickup_zip,
    pickup_date, pickup_time,
    delivery_address, delivery_city, delivery_state, delivery_zip,
    urgency, is_recurring, is_after_hours, notes
  )
  values (
    org.id,
    request_number, 'NEW', p_source::request_source,
    nullif(btrim(coalesce(p_company_name, '')), ''),
    btrim(p_contact_name),
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    btrim(p_pickup_address),
    nullif(btrim(coalesce(p_pickup_city, '')), ''),
    nullif(upper(btrim(coalesce(p_pickup_state, ''))), ''),
    nullif(btrim(coalesce(p_pickup_zip, '')), ''),
    p_pickup_date, p_pickup_time,
    btrim(p_delivery_address),
    nullif(btrim(coalesce(p_delivery_city, '')), ''),
    nullif(upper(btrim(coalesce(p_delivery_state, ''))), ''),
    nullif(btrim(coalesce(p_delivery_zip, '')), ''),
    nullif(p_urgency, '')::job_priority,
    p_is_recurring,
    after_hours,
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  -- Only the reference number goes back. No id, no read-back, nothing that
  -- could be used to enumerate other requests.
  return request_number;
end;
$$;

-- --- Function EXECUTE (see 0023) -----------------------------------------------------

revoke all on function issue_reference_number(uuid, text) from public, anon, authenticated;

revoke all on function next_reference_number(text) from public, anon;
grant execute on function next_reference_number(text) to authenticated;

revoke all on function assign_incident_number() from public, anon, authenticated;

revoke all on function create_public_job_request(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, date, time, text, boolean, text, text
) from public;
grant execute on function create_public_job_request(
  text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, date, time, text, boolean, text, text
) to anon, authenticated;

-- --- Temporary: the form as the live website calls it today ---------------------------
--
-- The website deployed before this migration calls the request function
-- without naming a company. Database and website cannot be switched at the
-- same instant, and without this the public form would fail in the gap.
--
-- It works ONLY while exactly one company exists — then there is no doubt
-- which company a request is for. The moment a second company is created it
-- refuses, exactly like an unknown company. It must be removed before any
-- second company is onboarded (Phase 2, milestone 4).

create function create_public_job_request(
  p_company_name text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_pickup_address text,
  p_pickup_city text,
  p_pickup_state text,
  p_pickup_zip text,
  p_delivery_address text,
  p_delivery_city text,
  p_delivery_state text,
  p_delivery_zip text,
  p_description text,
  p_pickup_date date,
  p_pickup_time time,
  p_urgency text,
  p_is_recurring boolean,
  p_source text default 'WEBSITE',
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  only_company text;
begin
  if (select count(*) from organisations) <> 1 then
    raise exception 'This request form is not available.'
      using errcode = 'insufficient_privilege';
  end if;
  select slug into only_company from organisations;

  return create_public_job_request(
    only_company::text, p_company_name, p_contact_name, p_contact_email, p_contact_phone,
    p_pickup_address, p_pickup_city, p_pickup_state, p_pickup_zip,
    p_delivery_address, p_delivery_city, p_delivery_state, p_delivery_zip,
    p_description, p_pickup_date, p_pickup_time, p_urgency, p_is_recurring,
    p_source, p_notes
  );
end;
$$;

comment on function create_public_job_request(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, date, time, text, boolean, text, text
) is 'TEMPORARY (0030): the pre-company form call. Works only while one company exists. Remove before a second company is onboarded.';

revoke all on function create_public_job_request(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, date, time, text, boolean, text, text
) from public;
grant execute on function create_public_job_request(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, date, time, text, boolean, text, text
) to anon, authenticated;
