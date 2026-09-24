-- =============================================================================
-- 0031 — Notifications go to the partners of the record's own company
--
-- notify_partners() wrote one notification to every active partner and admin
-- in the database. With one company that was everyone who should know. With
-- two it would tell one company's partners about another company's requests,
-- jobs and incidents — customer names included.
--
-- The function now takes the company as a required argument, and every caller
-- passes the company of the row that caused the notification. There is no
-- default: a notification with no company notifies nobody and fails loudly.
-- =============================================================================

drop function notify_partners(
  notification_type, notification_severity, text, text, text, uuid
);

create function notify_partners(
  p_organisation_id uuid,
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
  if p_organisation_id is null then
    raise exception 'A notification needs the company it is for.'
      using errcode = 'not_null_violation';
  end if;

  insert into notifications (
    organisation_id, recipient_user_id, notification_type, severity, title, body,
    entity_table, entity_id, delivered_channels
  )
  select p_organisation_id, u.id, p_type, p_severity, p_title, p_body,
         p_entity_table, p_entity_id, array['IN_APP']::notification_channel[]
  from users u
  where u.organisation_id = p_organisation_id
    and u.role in ('PARTNER', 'ADMIN')
    and u.status = 'ACTIVE';

  get diagnostics created = row_count;
  return created;
end;
$$;

comment on function notify_partners is
  'Notifies every active partner and admin OF ONE COMPANY. Executable by nobody: only the notification triggers call it.';

-- Raised by triggers only; a notification that can be raised on demand is a
-- notification that can be forged (0023).
revoke all on function notify_partners(
  uuid, notification_type, notification_severity, text, text, text, uuid
) from public, anon, authenticated;

-- --- The callers: each passes its own row's company -------------------------------

create or replace function notify_on_job_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform notify_partners(
    new.organisation_id,
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
    perform notify_partners(new.organisation_id, 'DELIVERY_COMPLETE', 'INFO',
      format('%s delivered', new.job_number), null, 'jobs', new.id);
  elsif new.status = 'POD_RECEIVED' then
    perform notify_partners(new.organisation_id, 'POD_UPLOADED', 'INFO',
      format('Proof of delivery captured for %s', new.job_number), null, 'jobs', new.id);
  elsif new.status = 'DRIVER_ACCEPTED' then
    perform notify_partners(new.organisation_id, 'DRIVER_ACCEPTED', 'INFO',
      format('%s accepted by the driver', new.job_number), null, 'jobs', new.id);
  elsif new.status = 'FAILED' then
    perform notify_partners(new.organisation_id, 'JOB_FAILED', 'URGENT',
      format('%s failed', new.job_number),
      'The job could not be completed. It needs attention.', 'jobs', new.id);
  end if;

  return null;
end;
$$;

create or replace function notify_partners_of_incident()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  severity notification_severity;
begin
  severity := case new.severity
    when 'MINOR' then 'ATTENTION'::notification_severity
    else 'URGENT'::notification_severity
  end;

  perform notify_partners(
    new.organisation_id,
    'INCIDENT_REPORTED'::notification_type,
    severity,
    new.incident_number || ': ' || replace(new.incident_type::text, '_', ' '),
    left(new.description, 500),
    'incidents',
    new.id
  );

  return new;
end;
$$;
