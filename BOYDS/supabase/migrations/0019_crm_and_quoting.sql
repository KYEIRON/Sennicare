-- =============================================================================
-- BOYD'S Logistics LLC — 0019 CRM, quoting and pricing rules
--
-- A quote is never invented. Every quote comes from the pricing engine with its
-- full breakdown stored alongside it, so a price given six months ago can still
-- be explained.
--
-- Minimum contribution and target margin remain NOT CONFIGURED. The engine
-- reports that plainly rather than substituting an industry default.
-- =============================================================================

create type lead_stage as enum (
  'NEW', 'QUALIFIED', 'CONTACTED', 'CONVERSATION', 'QUOTE_REQUESTED',
  'QUOTE_SENT', 'FOLLOW_UP', 'WON', 'FIRST_JOB', 'REPEAT_CUSTOMER',
  'CONTRACT_OPPORTUNITY', 'LOST'
);

create type quote_status as enum (
  'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'
);

-- --- Leads -------------------------------------------------------------------

create table leads (
  id                       uuid primary key default gen_random_uuid(),
  lead_number              text not null unique,
  customer_id              uuid references customers (id) on delete set null,

  company_name             text not null,
  contact_name             text,
  contact_email            citext,
  contact_phone            text,

  stage                    lead_stage not null default 'NEW',
  source                   request_source not null default 'PARTNER',
  service_interest         text,
  estimated_value_cents    bigint,

  owner_user_id            uuid references users (id) on delete set null,
  next_followup_at         date,

  -- Recurring interest is how a one-off customer becomes a contract.
  is_recurring_opportunity boolean not null default false,
  recurring_detail         text,

  lost_reason              text,
  notes                    text,
  provenance               data_provenance not null default 'REAL',

  created_by               uuid references users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint leads_company_present check (length(btrim(company_name)) > 0),
  -- A lost lead records WHY. The reason is the data that improves targeting.
  constraint leads_lost_has_reason
    check (stage <> 'LOST' or length(btrim(coalesce(lost_reason, ''))) > 0),
  constraint leads_value_non_negative
    check (estimated_value_cents is null or estimated_value_cents >= 0)
);

comment on table leads is
  'The BOYD''S pipeline. A lost lead is retained with its reason — the reason is what eventually improves pricing and targeting.';

create index leads_stage_idx on leads (stage);
create index leads_followup_idx on leads (next_followup_at)
  where stage not in ('WON', 'LOST') ;

create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- --- Pricing rules -----------------------------------------------------------
--
-- Percentages are basis points so they stay integers. Every threshold is
-- nullable: NULL means NOT CONFIGURED, and the engine says so rather than
-- inventing a floor.

create table pricing_rules (
  id                                 uuid primary key default gen_random_uuid(),
  name                               text not null,
  job_type_id                        uuid references job_types (id) on delete cascade,
  priority_level                     job_priority,

  base_price_cents                   bigint,
  per_mile_cents                     integer,
  minimum_price_cents                bigint,

  urgency_multiplier_bps             integer,
  target_margin_bps                  integer,
  minimum_contribution_cents         bigint,
  minimum_contribution_per_mile_cents integer,
  empty_mile_risk_factor_bps         integer,

  active                             boolean not null default true,
  effective_from                     date not null default current_date,
  effective_to                       date,
  notes                              text,

  created_by                         uuid references users (id) on delete set null,
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now(),

  constraint pricing_rules_amounts_non_negative check (
    coalesce(base_price_cents, 0) >= 0
    and coalesce(per_mile_cents, 0) >= 0
    and coalesce(minimum_price_cents, 0) >= 0
    and coalesce(minimum_contribution_cents, 0) >= 0
  ),
  constraint pricing_rules_bps_sane check (
    coalesce(target_margin_bps, 0) between 0 and 9999
    and coalesce(urgency_multiplier_bps, 10000) between 0 and 100000
  )
);

comment on table pricing_rules is
  'Configurable pricing. Every threshold is nullable because BOYD''S minimum contribution and target margin are open business decisions — NULL means NOT CONFIGURED, and the engine reports that rather than assuming a value.';
comment on constraint pricing_rules_bps_sane on pricing_rules is
  'A target margin of 100% or more is arithmetically impossible to price for: cost divided by zero.';

create trigger pricing_rules_set_updated_at
  before update on pricing_rules
  for each row execute function set_updated_at();

-- --- Quotes ------------------------------------------------------------------

create table quotes (
  id                                  uuid primary key default gen_random_uuid(),
  quote_number                        text not null unique,
  customer_id                         uuid references customers (id) on delete restrict,
  lead_id                             uuid references leads (id) on delete set null,
  job_id                              uuid references jobs (id) on delete set null,
  job_type_id                         uuid not null references job_types (id) on delete restrict,
  priority                            job_priority not null default 'STANDARD',

  collection_summary                  text,
  delivery_summary                    text,
  requested_date                      date,
  requested_time                      time,

  estimated_miles_tenths              integer,
  estimated_cost_cents                bigint,
  recommended_price_cents             bigint,
  quoted_price_cents                  bigint not null,

  expected_contribution_cents         bigint,
  expected_contribution_per_mile_cents integer,

  -- The complete, inspectable calculation behind the price. Stored so a quote
  -- given months ago can still be explained line by line.
  pricing_breakdown                   jsonb not null default '{}'::jsonb,

  -- Pricing below the configured floor requires an explicit, audited override.
  below_minimum_override              boolean not null default false,
  override_reason                     text,

  terms                               text,
  valid_until                         date,
  status                              quote_status not null default 'DRAFT',
  sent_at                             timestamptz,
  responded_at                        timestamptz,
  declined_reason                     text,

  notes                               text,
  provenance                          data_provenance not null default 'REAL',

  created_by                          uuid references users (id) on delete set null,
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now(),

  constraint quotes_price_non_negative check (quoted_price_cents >= 0),
  constraint quotes_override_has_reason check (
    not below_minimum_override or length(btrim(coalesce(override_reason, ''))) > 0
  )
);

comment on table quotes is
  'Quotes issued by BOYD''S. pricing_breakdown holds the full calculation, so a price can always be explained rather than merely asserted.';
comment on column quotes.below_minimum_override is
  'True when a partner deliberately priced below the configured minimum contribution. Requires a reason, and the change is audited.';

create index quotes_status_idx on quotes (status);
create index quotes_customer_idx on quotes (customer_id);
create index quotes_expiry_idx on quotes (valid_until)
  where status in ('SENT', 'VIEWED');

create trigger quotes_set_updated_at
  before update on quotes
  for each row execute function set_updated_at();

create table quote_items (
  id               uuid primary key default gen_random_uuid(),
  quote_id         uuid not null references quotes (id) on delete cascade,
  sequence         integer not null,
  description      text not null,
  quantity         numeric(10, 2) not null default 1,
  unit_price_cents bigint not null,
  total_cents      bigint not null,

  unique (quote_id, sequence)
);

-- --- An expired quote cannot be accepted -------------------------------------

create or replace function enforce_quote_acceptance()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ACCEPTED' and old.status is distinct from 'ACCEPTED' then
    if new.valid_until is not null and new.valid_until < current_date then
      raise exception
        'This quote expired on %. Re-issue it before accepting.', new.valid_until
        using errcode = 'check_violation';
    end if;
    new.responded_at := coalesce(new.responded_at, now());
  end if;

  if new.status = 'SENT' and old.status is distinct from 'SENT' then
    new.sent_at := coalesce(new.sent_at, now());
  end if;

  return new;
end;
$$;

create trigger quotes_enforce_acceptance
  before update on quotes
  for each row execute function enforce_quote_acceptance();

-- --- Row level security ------------------------------------------------------
-- Commercial data. Partners only: a driver has no policy on any of these tables
-- and therefore sees zero rows.

alter table leads enable row level security;
alter table pricing_rules enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table leads force row level security;
alter table pricing_rules force row level security;
alter table quotes force row level security;
alter table quote_items force row level security;

create policy leads_partner on leads
  for all using (is_partner()) with check (is_partner());
create policy pricing_rules_partner on pricing_rules
  for all using (is_partner()) with check (is_partner());
create policy quotes_partner on quotes
  for all using (is_partner()) with check (is_partner());
create policy quote_items_partner on quote_items
  for all using (is_partner()) with check (is_partner());

revoke all on leads, pricing_rules, quotes, quote_items from anon, authenticated;
grant select, insert, update, delete on leads, pricing_rules, quotes, quote_items
  to authenticated;

create trigger quotes_audit
  after insert or update on quotes
  for each row execute function write_audit_log();
create trigger leads_audit
  after insert or update on leads
  for each row execute function write_audit_log();
create trigger pricing_rules_audit
  after insert or update on pricing_rules
  for each row execute function write_audit_log();
