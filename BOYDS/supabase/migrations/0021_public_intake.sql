-- =============================================================================
-- BOYD'S Logistics LLC — 0021 public job request intake
--
-- The public website has NO table grants. An anonymous visitor can create
-- exactly one shape of record, through one function, and can read nothing back.
--
-- This is the 2 AM scenario's foundation: a request arriving at two in the
-- morning is recorded, flagged, and left for a partner to review. Nothing about
-- it is confirmed, because at 2 AM nobody has checked whether BOYD'S can do it.
-- =============================================================================

/**
 * Create a job request from the public website.
 *
 * SECURITY DEFINER, so an anonymous caller can insert without holding any grant
 * on job_requests. Returns only the request number — there is no read-back, so
 * this cannot be used to enumerate anything.
 */
create or replace function create_public_job_request(
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
  request_number text;
  after_hours boolean;
  local_hour integer;
begin
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

  -- After hours in BOYD'S operating time zone, not the visitor's.
  local_hour := extract(hour from (now() at time zone 'America/New_York'));
  after_hours := local_hour >= 18 or local_hour < 7;

  request_number := 'BR-' || to_char(now(), 'YYYY') || '-' ||
    lpad((select count(*) + 1 from job_requests)::text, 4, '0');

  insert into job_requests (
    request_number, status, source,
    company_name, contact_name, contact_email, contact_phone,
    description,
    pickup_address, pickup_city, pickup_state, pickup_zip,
    pickup_date, pickup_time,
    delivery_address, delivery_city, delivery_state, delivery_zip,
    urgency, is_recurring, is_after_hours, notes
  )
  values (
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

comment on function create_public_job_request is
  'The single write the public website can perform. Returns only a reference number. A request is never a confirmed job — a partner reviews it.';

revoke all on function create_public_job_request from public;
grant execute on function create_public_job_request to anon, authenticated;

-- --- What the public may read ------------------------------------------------
-- Active service types and service areas, and nothing else. No prices, no
-- availability, no customers, no jobs.

create policy job_types_select_public on job_types
  for select to anon using (active);

grant select on job_types to anon;
