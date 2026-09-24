-- =============================================================================
-- BOYD'S Logistics LLC — 0022 notifications
--
-- Notifications are how BOYD'S surfaces what needs attention, and how an
-- outbound message survives having no provider connected: it becomes a
-- notification a partner acts on, rather than a message quietly never sent.
--
-- Delivery is recorded per channel. A notification is not "sent" because it was
-- created — it is sent when a channel confirms it, and IN_APP is the only
-- channel BOYD'S currently has.
-- =============================================================================

create type notification_type as enum (
  'NEW_REQUEST', 'AFTER_HOURS_REQUEST', 'URGENT_REQUEST',
  'JOB_ASSIGNED', 'DRIVER_ACCEPTED', 'COLLECTION_COMPLETE', 'DELIVERY_COMPLETE',
  'POD_UPLOADED', 'JOB_FAILED',
  'INVOICE_OVERDUE', 'MAINTENANCE_DUE', 'FOLLOW_UP_DUE',
  'DATA_INCOMPLETE', 'AI_INSIGHT', 'OUTBOUND_MESSAGE_QUEUED'
);

create type notification_severity as enum ('INFO', 'ATTENTION', 'URGENT');

create type notification_channel as enum ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

create table notifications (
  id                 uuid primary key default gen_random_uuid(),
  recipient_user_id  uuid references users (id) on delete cascade,
  notification_type  notification_type not null,
  severity           notification_severity not null default 'INFO',
  title              text not null,
  body               text,

  entity_table       text,
  entity_id          uuid,

  -- Channels a delivery was actually confirmed on. IN_APP is the only channel
  -- BOYD'S has; email and SMS join this array when those providers connect.
  delivered_channels notification_channel[] not null default '{}',
  -- A channel BOYD'S wanted but could not use, so a partner knows to act.
  failed_channels    notification_channel[] not null default '{}',

  read_at            timestamptz,
  acted_at           timestamptz,
  created_at         timestamptz not null default now(),

  constraint notifications_title_present check (length(btrim(title)) > 0),
  -- A notification addressed to nobody would never be seen. A broadcast to all
  -- partners is expressed as one row per partner, not as a null recipient.
  constraint notifications_has_recipient check (recipient_user_id is not null)
);

comment on column notifications.failed_channels is
  'Channels BOYD''S wanted to use and could not — usually because no provider is connected. The partner sees this and sends the message themselves.';

create index notifications_recipient_idx
  on notifications (recipient_user_id, created_at desc);
create index notifications_unread_idx
  on notifications (recipient_user_id) where read_at is null;

-- --- Raising a notification --------------------------------------------------

/**
 * Notify every active partner.
 *
 * One row per partner rather than a broadcast row, so read state is per person
 * and nothing is "read" for Ronald because Moh looked at it.
 */
create or replace function notify_partners(
  p_type notification_type,
  p_severity notification_severity,
  p_title text,
  p_body text default null,
  p_entity_table text default null,
  p_entity_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  created integer;
begin
  insert into notifications (
    recipient_user_id, notification_type, severity, title, body,
    entity_table, entity_id, delivered_channels
  )
  select u.id, p_type, p_severity, p_title, p_body, p_entity_table, p_entity_id,
         array['IN_APP']::notification_channel[]
  from users u
  where u.role in ('PARTNER', 'ADMIN') and u.status = 'ACTIVE';

  get diagnostics created = row_count;
  return created;
end;
$$;

-- --- Automatic notifications -------------------------------------------------

create or replace function notify_on_job_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform notify_partners(
    case
      when new.is_after_hours then 'AFTER_HOURS_REQUEST'::notification_type
      when new.urgency in ('URGENT', 'CRITICAL') then 'URGENT_REQUEST'::notification_type
      else 'NEW_REQUEST'::notification_type
    end,
    case
      when new.urgency in ('URGENT', 'CRITICAL') then 'URGENT'::notification_severity
      when new.is_after_hours then 'ATTENTION'::notification_severity
      else 'INFO'::notification_severity
    end,
    case
      when new.is_after_hours then 'After-hours delivery request'
      else 'New delivery request'
    end,
    format(
      '%s from %s. Nothing has been confirmed — this needs review.',
      new.request_number,
      coalesce(new.company_name, new.contact_name, 'a customer')
    ),
    'job_requests',
    new.id
  );

  return null;
end;
$$;

create trigger job_requests_notify
  after insert on job_requests
  for each row execute function notify_on_job_request();

create or replace function notify_on_job_milestone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'DELIVERED' then
    perform notify_partners('DELIVERY_COMPLETE', 'INFO',
      format('%s delivered', new.job_number), null, 'jobs', new.id);
  elsif new.status = 'POD_RECEIVED' then
    perform notify_partners('POD_UPLOADED', 'INFO',
      format('Proof of delivery captured for %s', new.job_number), null, 'jobs', new.id);
  elsif new.status = 'DRIVER_ACCEPTED' then
    perform notify_partners('DRIVER_ACCEPTED', 'INFO',
      format('%s accepted by the driver', new.job_number), null, 'jobs', new.id);
  elsif new.status = 'FAILED' then
    perform notify_partners('JOB_FAILED', 'URGENT',
      format('%s failed', new.job_number),
      'The job could not be completed. It needs attention.', 'jobs', new.id);
  end if;

  return null;
end;
$$;

create trigger jobs_notify_milestones
  after update on jobs
  for each row execute function notify_on_job_milestone();

-- --- Row level security ------------------------------------------------------

alter table notifications enable row level security;
alter table notifications force row level security;

-- A person sees their own notifications and nobody else's.
create policy notifications_select_own on notifications
  for select using (recipient_user_id = current_app_user_id());

-- Marking one read or acted-on is the only change a recipient may make. There
-- is deliberately no insert policy: notifications arrive from triggers, so one
-- cannot be forged.
create policy notifications_update_own on notifications
  for update using (recipient_user_id = current_app_user_id())
  with check (recipient_user_id = current_app_user_id());

revoke all on notifications from anon, authenticated;
grant select, update on notifications to authenticated;
