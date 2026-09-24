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

  // Rule 28, by direct query (0028). The jobs table carries every price and
  // cost, so a driver reads none of it — not even their own job's row. Their
  // job reaches them through driver_jobs, which has no financial column.
  it('shows a driver NOTHING from the jobs table, not even their own job', async () => {
    const client = await sessionClient(driver.authUserId);
    const all = await client.query('select id from jobs');
    const priced = await client.query(
      'select won_price_cents, quoted_price_cents from jobs where id = $1',
      [assignedJobId],
    );
    await client.end();
    expect(all.rowCount).toBe(0);
    expect(priced.rowCount).toBe(0);
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
  it('changes nothing with a direct update, price or otherwise', async () => {
    const client = await sessionClient(driver.authUserId);
    const price = await client.query(
      'update jobs set won_price_cents = 99999 where id = $1',
      [assignedJobId],
    );
    const reassign = await client.query('update jobs set driver_id = $2 where id = $1', [
      assignedJobId,
      otherDriverRecordId,
    ]);
    const notes = await client.query(
      "update jobs set internal_notes = 'x' where id = $1",
      [assignedJobId],
    );
    await client.end();
    expect([price.rowCount, reassign.rowCount, notes.rowCount]).toEqual([0, 0, 0]);

    const after = await admin.query<{ won_price_cents: string; driver_id: string }>(
      'select won_price_cents, driver_id from jobs where id = $1',
      [assignedJobId],
    );
    expect(Number(after.rows[0]!.won_price_cents)).toBe(30_000);
    expect(after.rows[0]!.driver_id).toBe(driverRecordId);
  });

  it('refuses advancing a job assigned to someone else', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query("select driver_advance_job($1, 'DRIVER_ACCEPTED')", [otherJobId]),
    ).rejects.toThrow(/not assigned to you/i);
    await client.end();
  });

  it('refuses the job functions to a partner session', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(
      client.query("select driver_advance_job($1, 'DRIVER_ACCEPTED')", [assignedJobId]),
    ).rejects.toThrow(/only a driver/i);
    await client.end();
  });

  it('still enforces the state machine through the function', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query("select driver_advance_job($1, 'COMPLETED')", [assignedJobId]),
    ).rejects.toThrow();
    await client.end();
  });

  it('refuses mileage that runs backwards', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query('select driver_record_mileage($1, 1000, 900, 0)', [assignedJobId]),
    ).rejects.toThrow(/cannot be lower/i);
    await client.end();
  });

  it('DOES let a driver record field progress on their own job', async () => {
    const client = await sessionClient(driver.authUserId);
    await client.query("select driver_advance_job($1, 'DRIVER_ACCEPTED')", [
      assignedJobId,
    ]);
    await client.query('select driver_record_mileage($1, 1000, 1250, 50)', [
      assignedJobId,
    ]);
    await client.end();

    const after = await admin.query<{
      status: string;
      actual_miles_tenths: number;
      loaded_miles_tenths: number;
    }>(
      'select status, actual_miles_tenths, loaded_miles_tenths from jobs where id = $1',
      [assignedJobId],
    );
    expect(after.rows[0]).toMatchObject({
      status: 'DRIVER_ACCEPTED',
      actual_miles_tenths: 250,
      loaded_miles_tenths: 200,
    });
  });
});

describe('vehicles', () => {
  it('lets a partner manage the fleet', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from vehicles');
    await client.end();
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });

  // The vehicles table holds purchase price, insurance cost and policy number
  // (rule 28). The driver's van reaches them as vehicle_code via driver_jobs.
  it('shows a driver no vehicle row, not even the van they are in', async () => {
    await admin.query('update drivers set current_vehicle_id = $2 where id = $1', [
      driverRecordId,
      vehicleId,
    ]);

    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select purchase_price_cents from vehicles');
    await client.end();

    expect(result.rowCount).toBe(0);
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
