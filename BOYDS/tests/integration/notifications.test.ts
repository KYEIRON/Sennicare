import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { jobTypeId, seedCustomer, seedJob, seedVehicle } from './helpers/operations';

/**
 * Notifications.
 *
 * How BOYD'S surfaces what needs attention, and how an outbound message
 * survives having no provider connected. A notification is per-person, cannot
 * be forged, and is never marked delivered on a channel that did not carry it.
 */

let admin: Client;
let partnerA: SeededUser;
let partnerB: SeededUser;
let driver: SeededUser;
let customerId: string;
let typeId: string;
let vehicleId: string;
let driverRecordId: string;

beforeAll(async () => {
  admin = await adminClient();

  partnerA = await seedUser(admin, {
    email: 'notify-a@boyds.test',
    firstName: 'NotifyA',
    role: 'PARTNER',
  });
  partnerB = await seedUser(admin, {
    email: 'notify-b@boyds.test',
    firstName: 'NotifyB',
    role: 'PARTNER',
  });
  driver = await seedUser(admin, {
    email: 'notify-driver@boyds.test',
    firstName: 'NotifyDriver',
    role: 'DRIVER',
  });

  for (const partner of [partnerA, partnerB]) {
    await admin.query(
      'insert into partners (user_id, name, role_title) values ($1, $2, $3)',
      [partner.userId, partner.email, 'Test Partner'],
    );
  }

  driverRecordId = await seedDriverRecord(admin, driver.userId);
  customerId = await seedCustomer(admin, 'NOTIFY FIXTURE');
  typeId = await jobTypeId(admin);
  vehicleId = await seedVehicle(admin, 'NOTIFY-V1');
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

/** A distinct scheduled date per fixture job, so none double-books the van. */
let scheduleCounter = 0;
function nextScheduleDate(): string {
  scheduleCounter += 1;
  const day = String((scheduleCounter % 28) + 1).padStart(2, '0');
  const month = String((Math.floor(scheduleCounter / 28) % 12) + 1).padStart(2, '0');
  return `2028-${month}-${day}`;
}

async function submitRequest(options: { urgency?: string } = {}) {
  const result = await admin.query<{ id: string }>(
    `insert into job_requests (request_number, source, contact_name, company_name, urgency, is_after_hours)
     values ($1, 'WEBSITE', 'A Contact', 'A Company', $2, false) returning id`,
    [`BR-TEST-${Math.random().toString(36).slice(2, 8)}`, options.urgency ?? null],
  );
  return result.rows[0]!.id;
}

describe('a new request notifies every partner', () => {
  it('creates one notification per active partner, not a shared one', async () => {
    const requestId = await submitRequest();

    const result = await admin.query<{ recipient_user_id: string }>(
      'select recipient_user_id from notifications where entity_id = $1',
      [requestId],
    );

    const recipients = result.rows.map((r) => r.recipient_user_id);
    expect(recipients).toContain(partnerA.userId);
    expect(recipients).toContain(partnerB.userId);
    // Read state is per person: nothing is read for Ronald because Moh saw it.
    expect(new Set(recipients).size).toBe(recipients.length);
  });

  it('does not notify a driver about an incoming request', async () => {
    const requestId = await submitRequest();

    const result = await admin.query(
      'select id from notifications where entity_id = $1 and recipient_user_id = $2',
      [requestId, driver.userId],
    );
    expect(result.rowCount).toBe(0);
  });

  it('raises the severity of an urgent request', async () => {
    const requestId = await submitRequest({ urgency: 'CRITICAL' });

    const result = await admin.query<{ severity: string; notification_type: string }>(
      'select severity, notification_type from notifications where entity_id = $1 limit 1',
      [requestId],
    );

    expect(result.rows[0]!.severity).toBe('URGENT');
    expect(result.rows[0]!.notification_type).toBe('URGENT_REQUEST');
  });

  it('flags an after-hours request as needing attention', async () => {
    const result = await admin.query<{ id: string }>(
      `insert into job_requests (request_number, source, contact_name, is_after_hours)
       values ($1, 'WEBSITE', 'Night Caller', true) returning id`,
      [`BR-TEST-${Math.random().toString(36).slice(2, 8)}`],
    );

    const notification = await admin.query<{ notification_type: string; body: string }>(
      'select notification_type, body from notifications where entity_id = $1 limit 1',
      [result.rows[0]!.id],
    );

    expect(notification.rows[0]!.notification_type).toBe('AFTER_HOURS_REQUEST');
    // The body must not imply the job is going ahead.
    expect(notification.rows[0]!.body).toMatch(/nothing has been confirmed/i);
  });
});

describe('job milestones notify the partners', () => {
  async function runJobTo(status: string): Promise<string> {
    const jobId = await seedJob(admin, {
      customerId,
      jobTypeId: typeId,
      status: 'APPROVED',
    });
    await admin.query(
      `update jobs set status = 'SCHEDULED', scheduled_date = $2, scheduled_time = '09:00',
       scheduled_window_end = '11:00' where id = $1`,
      // Each job gets its own slot: reusing a date and time would trip the
      // real double-booking rule, which is working as intended.
      [jobId, nextScheduleDate()],
    );
    await admin.query(
      "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
      [jobId, vehicleId, driverRecordId],
    );

    const path = [
      'DRIVER_ACCEPTED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DELIVERY',
      'DELIVERED',
    ];

    for (const step of path) {
      await admin.query('update jobs set status = $2 where id = $1', [jobId, step]);
      if (step === status) break;
    }

    return jobId;
  }

  it('notifies when the driver accepts', async () => {
    const jobId = await runJobTo('DRIVER_ACCEPTED');
    const result = await admin.query(
      "select id from notifications where entity_id = $1 and notification_type = 'DRIVER_ACCEPTED'",
      [jobId],
    );
    expect(result.rowCount).toBeGreaterThanOrEqual(2);
  });

  it('notifies on delivery', async () => {
    const jobId = await runJobTo('DELIVERED');
    const result = await admin.query(
      "select id from notifications where entity_id = $1 and notification_type = 'DELIVERY_COMPLETE'",
      [jobId],
    );
    expect(result.rowCount).toBeGreaterThanOrEqual(2);
  });

  it('raises an URGENT notification when a job fails', async () => {
    const jobId = await runJobTo('IN_TRANSIT');
    await admin.query("update jobs set status = 'FAILED' where id = $1", [jobId]);

    const result = await admin.query<{ severity: string }>(
      "select severity from notifications where entity_id = $1 and notification_type = 'JOB_FAILED' limit 1",
      [jobId],
    );
    expect(result.rows[0]!.severity).toBe('URGENT');
  });
});

describe('delivery is recorded per channel', () => {
  it('records IN_APP only — the only channel BOYD’S has', async () => {
    const requestId = await submitRequest();

    // pg returns a Postgres enum array unparsed, so cast to text[] to get a
    // real JavaScript array back.
    const result = await admin.query<{ delivered: string[]; failed: string[] }>(
      `select delivered_channels::text[] as delivered, failed_channels::text[] as failed
       from notifications where entity_id = $1 limit 1`,
      [requestId],
    );

    expect(result.rows[0]!.delivered).toEqual(['IN_APP']);
    // Nothing claims an email or an SMS went out, because none did.
    expect(result.rows[0]!.delivered).not.toContain('EMAIL');
    expect(result.rows[0]!.delivered).not.toContain('SMS');
    expect(result.rows[0]!.failed).toEqual([]);
  });
});

describe('a notification belongs to one person', () => {
  it('shows a partner only their own', async () => {
    await submitRequest();

    const client = await sessionClient(partnerA.authUserId);
    const result = await client.query<{ recipient_user_id: string }>(
      'select recipient_user_id from notifications',
    );
    await client.end();

    expect(result.rowCount).toBeGreaterThan(0);
    expect(result.rows.every((r) => r.recipient_user_id === partnerA.userId)).toBe(true);
  });

  it('shows a driver none of the partners’ notifications', async () => {
    await submitRequest();

    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from notifications');
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('lets a recipient mark their own read', async () => {
    await submitRequest();

    const client = await sessionClient(partnerA.authUserId);
    const result = await client.query('update notifications set read_at = now()');
    await client.end();

    expect(result.rowCount).toBeGreaterThan(0);
  });

  it('cannot be forged — there is no insert policy', async () => {
    const client = await sessionClient(partnerA.authUserId);
    await expect(
      client.query(
        `insert into notifications (recipient_user_id, notification_type, title)
         values ($1, 'AI_INSIGHT', 'Forged')`,
        [partnerA.userId],
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
    await client.end();
  });

  it('refuses a notification addressed to nobody', async () => {
    await expect(
      admin.query(
        `insert into notifications (notification_type, title) values ('AI_INSIGHT', 'Nobody')`,
      ),
    ).rejects.toThrow(/has_recipient/i);
  });
});

describe('every table still has row level security', () => {
  it('leaves nothing unprotected', async () => {
    const result = await admin.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' and rowsecurity = false`,
    );
    expect(result.rows.map((r) => r.tablename)).toEqual([]);
  });
});
