import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedPartnerRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { jobTypeId, seedCustomer, seedJob, seedVehicle } from './helpers/operations';

/**
 * The Phase 2 security boundary, extended to every operational table.
 *
 * Business rules 27 to 30: a driver must never reach a price, a cost, a
 * contribution, a margin, a customer list, or another driver's work. Proved
 * against real PostgreSQL, because that is the layer that holds when
 * application code is wrong.
 */

let admin: Client;
let partner: SeededUser;
let driver: SeededUser;
let otherDriver: SeededUser;
let driverRecordId: string;
let otherDriverRecordId: string;
let customerId: string;
let vehicleId: string;
let typeId: string;
let assignedJobId: string;
let otherJobId: string;

beforeAll(async () => {
  admin = await adminClient();

  partner = await seedUser(admin, {
    email: 'ops-partner@boyds.test',
    firstName: 'OpsPartner',
    role: 'PARTNER',
  });
  driver = await seedUser(admin, {
    email: 'ops-driver@boyds.test',
    firstName: 'OpsDriver',
    role: 'DRIVER',
  });
  otherDriver = await seedUser(admin, {
    email: 'ops-other-driver@boyds.test',
    firstName: 'OtherOpsDriver',
    role: 'DRIVER',
  });

  await seedPartnerRecord(admin, partner.userId, 'OpsPartner', 'Test Partner');
  driverRecordId = await seedDriverRecord(admin, driver.userId);
  otherDriverRecordId = await seedDriverRecord(admin, otherDriver.userId);

  customerId = await seedCustomer(admin, 'TEST CUSTOMER (fixture)');
  vehicleId = await seedVehicle(admin, 'TEST-V1');
  typeId = await jobTypeId(admin);

  assignedJobId = await seedJob(admin, {
    customerId,
    jobTypeId: typeId,
    status: 'APPROVED',
    scheduledDate: '2026-10-01',
    scheduledTime: '09:00',
    windowEnd: '11:00',
    wonPriceCents: 30_000,
  });
  await admin.query("update jobs set status = 'SCHEDULED' where id = $1", [
    assignedJobId,
  ]);
  await admin.query(
    "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
    [assignedJobId, vehicleId, driverRecordId],
  );

  otherJobId = await seedJob(admin, {
    customerId,
    jobTypeId: typeId,
    status: 'APPROVED',
    scheduledDate: '2026-10-02',
    scheduledTime: '09:00',
    wonPriceCents: 50_000,
  });
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('customers are invisible to the driver surface', () => {
  it('lets a partner read customers', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from customers');
    await client.end();
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('shows a driver ZERO customers', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from customers');
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('shows a driver zero customer contacts, locations and notes', async () => {
    const client = await sessionClient(driver.authUserId);
    for (const table of ['customer_contacts', 'customer_locations', 'customer_notes']) {
      const result = await client.query(`select id from ${table}`);
      expect(result.rowCount).toBe(0);
    }
    await client.end();
  });

  it('does not let a driver create a customer', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        "insert into customers (customer_number, company_name) values ('X', 'Escalation')",
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });
});

describe('jobs: a driver sees only their own work', () => {
  it('lets a partner see every job', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from jobs');
    await client.end();
    expect(result.rowCount).toBeGreaterThanOrEqual(2);
  });

  it('shows a driver only the job assigned to them', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query<{ id: string }>('select id from jobs');
    await client.end();
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]!.id).toBe(assignedJobId);
  });

  it('shows a DIFFERENT driver none of it', async () => {
    const client = await sessionClient(otherDriver.authUserId);
    const result = await client.query('select id from jobs');
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('does not let a driver reach an unassigned job by id', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from jobs where id = $1', [otherJobId]);
    await client.end();
    expect(result.rowCount).toBe(0);
  });
});

describe('the driver_jobs view has no financial columns at all', () => {
  it('contains no price, cost, contribution or margin column', async () => {
    const result = await admin.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_name = 'driver_jobs'`,
    );
    const columns = result.rows.map((r) => r.column_name);

    for (const forbidden of [
      'price',
      'cost',
      'contribution',
      'margin',
      'internal_notes',
    ]) {
      expect(columns.filter((c) => c.includes(forbidden))).toEqual([]);
    }
  });

  it('gives a driver their job through the view', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query<{ job_number: string }>(
      'select job_number, customer_company_name from driver_jobs',
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('still shows another driver nothing through the view', async () => {
    const client = await sessionClient(otherDriver.authUserId);
    const result = await client.query('select job_number from driver_jobs');
    await client.end();
    expect(result.rowCount).toBe(0);
  });
});

describe('a driver cannot write what they must not write', () => {
  it('refuses a price change', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query('update jobs set won_price_cents = 99999 where id = $1', [
        assignedJobId,
      ]),
    ).rejects.toThrow(/not pricing, assignment or internal notes/i);
    await client.end();
  });

  it('refuses reassigning the job to themselves elsewhere', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query('update jobs set driver_id = $2 where id = $1', [
        assignedJobId,
        otherDriverRecordId,
      ]),
    ).rejects.toThrow(/not pricing, assignment or internal notes/i);
    await client.end();
  });

  it('refuses editing internal notes', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query("update jobs set internal_notes = 'x' where id = $1", [assignedJobId]),
    ).rejects.toThrow(/not pricing, assignment or internal notes/i);
    await client.end();
  });

  it('DOES let a driver record field progress on their own job', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query(
      "update jobs set status = 'DRIVER_ACCEPTED' where id = $1",
      [assignedJobId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });
});

describe('vehicles', () => {
  it('lets a partner manage the fleet', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from vehicles');
    await client.end();
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('shows a driver only the vehicle they are currently in', async () => {
    await admin.query('update drivers set current_vehicle_id = $2 where id = $1', [
      driverRecordId,
      vehicleId,
    ]);

    const client = await sessionClient(driver.authUserId);
    const result = await client.query<{ id: string }>('select id from vehicles');
    await client.end();

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]!.id).toBe(vehicleId);
  });

  it('shows a driver with no vehicle nothing', async () => {
    const client = await sessionClient(otherDriver.authUserId);
    const result = await client.query('select id from vehicles');
    await client.end();
    expect(result.rowCount).toBe(0);
  });
});

describe('the audit log is readable but not writable', () => {
  it('lets a partner read it', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from audit_logs');
    await client.end();
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it('shows a driver nothing', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from audit_logs');
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('does not let even a partner write to it directly', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(
      client.query(
        `insert into audit_logs (action, entity_table, entity_id)
         values ('FORGED', 'jobs', gen_random_uuid())`,
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
    await client.end();
  });

  it('does not let a partner alter or delete history', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(client.query("update audit_logs set action = 'X'")).rejects.toThrow(
      /permission denied|row-level security/i,
    );
    await expect(client.query('delete from audit_logs')).rejects.toThrow(
      /permission denied|row-level security/i,
    );
    await client.end();
  });
});

describe('every operational table has row level security', () => {
  it('leaves nothing unprotected', async () => {
    const result = await admin.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and rowsecurity = false`,
    );
    expect(result.rows.map((r) => r.tablename)).toEqual([]);
  });
});
