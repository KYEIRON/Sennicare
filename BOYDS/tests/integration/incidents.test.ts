import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedPartnerRecord,
  seedUser,
  sessionClient,
} from './helpers/db';
import { seedVehicle } from './helpers/operations';

/**
 * What happened on the road.
 *
 * The report is the driver's account of events, and the guarantees that make it
 * worth anything are in the database, not the interface: he cannot file one in
 * someone else's name, he cannot read anyone else's, and once it is filed he
 * cannot change or delete it. The partners are told by a trigger, so a report
 * cannot reach the record without reaching them.
 */

let admin: Client;
let partner: { authUserId: string; userId: string };
let mohDriverId: string;
let moh: { authUserId: string; userId: string };
let otherDriverId: string;
let other: { authUserId: string; userId: string };
let vehicleId: string;

beforeAll(async () => {
  admin = await adminClient();

  const partnerUser = await seedUser(admin, {
    email: `incident-partner-${Date.now()}@boyds.test`,
    firstName: 'Test',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, partnerUser.userId, 'Test Partner', 'Test Role');
  partner = partnerUser;

  moh = await seedUser(admin, {
    email: `incident-driver-a-${Date.now()}@boyds.test`,
    firstName: 'DriverA',
    role: 'DRIVER',
  });
  mohDriverId = await seedDriverRecord(admin, moh.userId);

  other = await seedUser(admin, {
    email: `incident-driver-b-${Date.now()}@boyds.test`,
    firstName: 'DriverB',
    role: 'DRIVER',
  });
  otherDriverId = await seedDriverRecord(admin, other.userId);

  vehicleId = await seedVehicle(admin, `TEST-V-INC-${Date.now()}`);
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

const REPORT_COLUMNS = `(
  incident_type, severity, vehicle_id, driver_id, description,
  anyone_injured, police_involved, third_party_involved, goods_affected
)`;

async function fileReport(
  client: Client,
  driverId: string,
  overrides: { description?: string; severity?: string } = {},
) {
  return client.query<{ id: string; incident_number: string; status: string }>(
    `insert into incidents ${REPORT_COLUMNS}
     values ('VEHICLE_BREAKDOWN', $3, $1, $2, $4, false, false, false, false)
     returning id, incident_number, status`,
    [
      vehicleId,
      driverId,
      overrides.severity ?? 'SERIOUS',
      overrides.description ?? 'The van would not restart after the second drop.',
    ],
  );
}

describe('a driver files a report', () => {
  it('is accepted, numbered, and starts as REPORTED', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await fileReport(client, mohDriverId);
    await client.end();

    expect(result.rows[0]!.incident_number).toMatch(/^BI-\d{4}-\d{4}$/);
    expect(result.rows[0]!.status).toBe('REPORTED');
  });

  it('gives every report its own number', async () => {
    const client = await sessionClient(moh.authUserId);
    const first = await fileReport(client, mohDriverId);
    const second = await fileReport(client, mohDriverId);
    await client.end();

    expect(first.rows[0]!.incident_number).not.toBe(second.rows[0]!.incident_number);
  });

  it('tells the partners, without the driver having to', async () => {
    const client = await sessionClient(moh.authUserId);
    const report = await fileReport(client, mohDriverId, { severity: 'CRITICAL' });
    await client.end();

    const notifications = await admin.query<{
      severity: string;
      notification_type: string;
      recipient_user_id: string;
    }>(
      `select severity, notification_type, recipient_user_id
         from notifications
        where entity_table = 'incidents' and entity_id = $1`,
      [report.rows[0]!.id],
    );

    expect(notifications.rows.length).toBeGreaterThan(0);
    expect(notifications.rows[0]!.notification_type).toBe('INCIDENT_REPORTED');
    // Critical wakes people. Minor does not.
    expect(notifications.rows[0]!.severity).toBe('URGENT');
    expect(notifications.rows.map((row) => row.recipient_user_id)).toContain(
      partner.userId,
    );
  });

  it('raises a quieter notification for something minor', async () => {
    const client = await sessionClient(moh.authUserId);
    const report = await fileReport(client, mohDriverId, { severity: 'MINOR' });
    await client.end();

    const notifications = await admin.query<{ severity: string }>(
      `select severity from notifications
        where entity_table = 'incidents' and entity_id = $1 limit 1`,
      [report.rows[0]!.id],
    );
    expect(notifications.rows[0]!.severity).toBe('ATTENTION');
  });
});

describe('a driver cannot file in someone else’s name', () => {
  it('is refused', async () => {
    const client = await sessionClient(moh.authUserId);
    await expect(fileReport(client, otherDriverId)).rejects.toThrow(/row-level security/);
    await client.end();
  });
});

/**
 * A driver has no update or delete policy on incidents, so the row is simply
 * not there to change: the statement matches nothing rather than raising. The
 * immutability trigger sits behind that as a second line — it is what would
 * refuse the edit if a policy were ever widened.
 */
describe('a filed report cannot be rewritten by a driver', () => {
  it('leaves the account of events untouched by an edit', async () => {
    const client = await sessionClient(moh.authUserId);
    const report = await fileReport(client, mohDriverId);

    const result = await client.query(
      'update incidents set description = $2 where id = $1',
      [report.rows[0]!.id, 'Actually it was fine.'],
    );
    await client.end();

    expect(result.rowCount).toBe(0);

    const after = await admin.query<{ description: string }>(
      'select description from incidents where id = $1',
      [report.rows[0]!.id],
    );
    expect(after.rows[0]!.description).toContain('would not restart');
  });

  it('leaves the report in place after a delete', async () => {
    const client = await sessionClient(moh.authUserId);
    const report = await fileReport(client, mohDriverId);

    const result = await client.query('delete from incidents where id = $1', [
      report.rows[0]!.id,
    ]);
    await client.end();

    expect(result.rowCount).toBe(0);

    const after = await admin.query('select id from incidents where id = $1', [
      report.rows[0]!.id,
    ]);
    expect(after.rowCount).toBe(1);
  });
});

describe('a driver sees only their own reports', () => {
  it('cannot read another driver’s', async () => {
    const filed = await admin.query<{ id: string }>(
      `insert into incidents ${REPORT_COLUMNS}
       values ('ACCIDENT', 'SERIOUS', $1, $2, 'A test account of events.',
               false, false, false, false)
       returning id`,
      [vehicleId, otherDriverId],
    );

    const client = await sessionClient(moh.authUserId);
    const result = await client.query('select id from incidents where id = $1', [
      filed.rows[0]!.id,
    ]);
    await client.end();

    expect(result.rowCount).toBe(0);
  });
});

describe('a partner works through an incident', () => {
  it('can record what was done and what it cost', async () => {
    const filed = await admin.query<{ id: string }>(
      `insert into incidents ${REPORT_COLUMNS}
       values ('GOODS_DAMAGED', 'SERIOUS', $1, $2, 'A test account of events.',
               false, false, false, true)
       returning id`,
      [vehicleId, mohDriverId],
    );

    const client = await sessionClient(partner.authUserId);
    await client.query(
      `update incidents
          set status = 'RESOLVED', resolution_notes = $2, cost_cents = $3,
              reviewed_by = $4, reviewed_at = now()
        where id = $1`,
      [
        filed.rows[0]!.id,
        'Replaced the damaged item and told the customer.',
        4200,
        partner.userId,
      ],
    );
    const after = await client.query<{ status: string; cost_cents: string }>(
      'select status, cost_cents from incidents where id = $1',
      [filed.rows[0]!.id],
    );
    await client.end();

    expect(after.rows[0]!.status).toBe('RESOLVED');
    expect(after.rows[0]!.cost_cents).toBe('4200');
  });

  it('cannot resolve one without saying how', async () => {
    const filed = await admin.query<{ id: string }>(
      `insert into incidents ${REPORT_COLUMNS}
       values ('DELAY', 'MINOR', $1, $2, 'A test account of events.',
               false, false, false, false)
       returning id`,
      [vehicleId, mohDriverId],
    );

    const client = await sessionClient(partner.authUserId);
    await expect(
      client.query("update incidents set status = 'RESOLVED' where id = $1", [
        filed.rows[0]!.id,
      ]),
    ).rejects.toThrow(/incidents_resolved_has_notes/);
    await client.end();
  });
});

describe('the record refuses a report that contradicts itself', () => {
  it('will not take a police report number with no police', async () => {
    await expect(
      admin.query(
        `insert into incidents (
           incident_type, severity, vehicle_id, driver_id, description,
           anyone_injured, police_involved, police_report_number,
           third_party_involved, goods_affected
         ) values ('ACCIDENT', 'SERIOUS', $1, $2, 'A test account of events.',
                   false, false, 'PR-TEST-1', false, false)`,
        [vehicleId, mohDriverId],
      ),
    ).rejects.toThrow(/incidents_police_report_needs_police/);
  });

  it('will not take an empty account of what happened', async () => {
    await expect(
      admin.query(
        `insert into incidents ${REPORT_COLUMNS}
         values ('OTHER', 'MINOR', $1, $2, '   ', false, false, false, false)`,
        [vehicleId, mohDriverId],
      ),
    ).rejects.toThrow(/incidents_description_present/);
  });

  it('will not take a negative cost', async () => {
    await expect(
      admin.query(
        `insert into incidents (
           incident_type, severity, vehicle_id, driver_id, description,
           anyone_injured, police_involved, third_party_involved, goods_affected,
           cost_cents
         ) values ('OTHER', 'MINOR', $1, $2, 'A test account of events.',
                   false, false, false, false, -100)`,
        [vehicleId, mohDriverId],
      ),
    ).rejects.toThrow(/incidents_cost_not_negative/);
  });
});

describe('the public cannot reach incidents at all', () => {
  it('is refused the table', async () => {
    const client = await sessionClient(null);
    await expect(client.query('select * from incidents')).rejects.toThrow(
      /permission denied/,
    );
    await client.end();
  });
});
