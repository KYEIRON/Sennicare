-- =============================================================================
-- BOYD'S Logistics LLC — 0011 audit trail
--
-- Written by database trigger, not by application code, so a change cannot
-- escape the log by taking a different code path. Append-only: no role holds
-- UPDATE or DELETE.
-- =============================================================================

create table audit_logs (
  id            bigserial primary key,
  user_id       uuid references users (id) on delete set null,
  action        text not null,
  entity_table  text not null,
  entity_id     uuid not null,
  field         text,
  old_value     text,
  new_value     text,
  changed       jsonb,
  created_at    timestamptz not null default now()
);

comment on table audit_logs is
  'Append-only record of important operational changes. Trigger-written so no code path can avoid it.';

create index audit_logs_entity_idx on audit_logs (entity_table, entity_id, created_at desc);
create index audit_logs_user_idx on audit_logs (user_id, created_at desc);
create index audit_logs_action_idx on audit_logs (action, created_at desc);

-- --- Which columns matter ----------------------------------------------------

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
    else array[]::text[]
  end;
$$;

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
    insert into audit_logs (user_id, action, entity_table, entity_id, new_value, changed)
    values (
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

      insert into audit_logs (user_id, action, entity_table, entity_id, field, old_value, new_value)
      values (
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

create trigger jobs_audit
  after insert or update on jobs
  for each row execute function write_audit_log();

create trigger customers_audit
  after insert or update on customers
  for each row execute function write_audit_log();

create trigger vehicles_audit
  after insert or update on vehicles
  for each row execute function write_audit_log();

create trigger drivers_audit
  after insert or update on drivers
  for each row execute function write_audit_log();
