-- =============================================================================
-- BOYD'S Logistics LLC — 0012 job requests
--
-- A REQUEST IS NOT A JOB. An enquiry arriving from the website, the AI
-- receptionist, the phone or email is recorded here and stays here until a
-- partner reviews it. Nothing is automatically accepted as work BOYD'S has
-- committed to. See the master instruction, sections 15 and 46.
-- =============================================================================

create table job_requests (
  id                    uuid primary key default gen_random_uuid(),
  request_number        text not null unique,
  status                request_status not null default 'NEW',
  source                request_source not null,

  -- The enquirer, as stated. They may not be an existing customer.
  customer_id           uuid references customers (id) on delete set null,
  company_name          text,
  contact_name          text,
  contact_email         citext,
  contact_phone         text,

  -- What they are asking for, in their words. Nothing is inferred.
  job_type_id           uuid references job_types (id) on delete set null,
  description           text,
  quantity              integer,
  weight_lbs            numeric(10, 2),
  dimensions            text,
  pallets               integer,
  special_handling      text,
  urgency               job_priority,

  pickup_address        text,
  pickup_city           text,
  pickup_state          text,
  pickup_zip            text,
  pickup_date           date,
  pickup_time           time,

  delivery_address      text,
  delivery_city         text,
  delivery_state        text,
  delivery_zip          text,
  delivery_date         date,
  delivery_time         time,

  is_recurring          boolean,
  recurring_detail      text,

  -- After-hours arrivals are flagged so nothing waits unnoticed overnight.
  is_after_hours        boolean not null default false,
  received_at           timestamptz not null default now(),

  -- Review
  reviewed_by           uuid references users (id) on delete set null,
  reviewed_at           timestamptz,
  review_notes          text,
  declined_reason       text,
  converted_job_id      uuid references jobs (id) on delete set null,

  notes                 text,
  provenance            data_provenance not null default 'REAL',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint job_requests_declined_has_reason check (
    status <> 'DECLINED' or length(btrim(coalesce(declined_reason, ''))) > 0
  ),
  constraint job_requests_converted_has_job check (
    status <> 'CONVERTED' or converted_job_id is not null
  )
);

comment on table job_requests is
  'Incoming enquiries. A request becomes a job only when a partner converts it. Nothing here represents work BOYD''S has agreed to do.';
comment on column job_requests.is_after_hours is
  'True when received outside BOYD''S working hours in America/New_York. The 2 AM scenario: recorded, flagged, and never auto-confirmed.';

create index job_requests_status_idx on job_requests (status, received_at desc);
create index job_requests_after_hours_idx on job_requests (received_at desc)
  where is_after_hours and status = 'NEW';

create trigger job_requests_set_updated_at
  before update on job_requests
  for each row execute function set_updated_at();
