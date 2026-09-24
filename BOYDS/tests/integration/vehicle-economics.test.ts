import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { seedVehicle } from './helpers/operations';

/**
 * Vehicle economics at the database.
 *
 * Vehicle costs are company financial information: a driver must not reach them.
 * Completed maintenance with a cost becomes a cost entry, so true cost per mile
 * reflects work actually done rather than only what was planned.
 */

let admin: Client;
let partner: SeededUser;
let driver: SeededUser;
let vehicleId: string;

beforeAll(async () => {
  admin = await adminClient();

  partner = await seedUser(admin, {
    email: 'econ-partner@boyds.test',
    firstName: 'EconPartner',
    role: 'PARTNER',
  });
  await admin.query(
    'insert into partners (user_id, name, role_title) values ($1, $2, $3)',
    [partner.userId, 'EconPartner', 'Test Partner'],
  );

  driver = await seedUser(admin, {
    email: 'econ-driver@boyds.test',
    firstName: 'EconDriver',
    role: 'DRIVER',
  });
  const driverRecordId = await seedDriverRecord(admin, driver.userId);

  vehicleId = await seedVehicle(admin, 'ECON-V1');
  await admin.query('update drivers set current_vehicle_id = $2 where id = $1', [
    driverRecordId,
    vehicleId,
  ]);
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('vehicle costs are partner-only', () => {
  it('lets a partner record and read a cost entry', async () => {
    const client = await sessionClient(partner.authUserId);
    const inserted = await client.query(
      `insert into vehicle_cost_entries (vehicle_id, cost_line, period, amount_cents, effective_from)
       values ($1, 'INSURANCE', 'ANNUAL', 120000, '2026-01-01') returning id`,
      [vehicleId],
    );
    const read = await client.query('select id from vehicle_cost_entries');
    await client.end();

    expect(inserted.rowCount).toBe(1);
    expect(read.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('shows a driver ZERO vehicle cost entries', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from vehicle_cost_entries');
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('does not let a driver record one', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        `insert into vehicle_cost_entries (vehicle_id, cost_line, period, amount_cents, effective_from)
         values ($1, 'FUEL', 'MONTHLY', 1000, '2026-01-01')`,
        [vehicleId],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });

  it('shows a driver ZERO maintenance cost records', async () => {
    await admin.query(
      `insert into maintenance_records (vehicle_id, maintenance_type, due_date, cost_cents)
       values ($1, 'SERVICE', '2026-12-01', 45000)`,
      [vehicleId],
    );

    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from maintenance_records');
    await client.end();
    expect(result.rowCount).toBe(0);
  });
});

describe('the driver maintenance view carries no money', () => {
  it('has no cost or vendor column', async () => {
    const result = await admin.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_name = 'driver_vehicle_maintenance'`,
    );
    const columns = result.rows.map((r) => r.column_name);

    expect(columns).not.toContain('cost_cents');
    expect(columns).not.toContain('vendor');
    expect(columns).toContain('due_date');
  });

  it('shows a driver what is due on their own vehicle', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from driver_vehicle_maintenance');
    await client.end();
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });
});

describe('completed maintenance becomes a vehicle cost', () => {
  it('creates a cost entry when work is completed with a cost', async () => {
    const van = await seedVehicle(admin, 'ECON-V2');
    const record = await admin.query<{ id: string }>(
      `insert into maintenance_records (vehicle_id, maintenance_type, description,
        completed_date, cost_cents)
       values ($1, 'TYRES', 'Replaced tyres', '2026-06-01', 80000) returning id`,
      [van],
    );

    const entries = await admin.query<{
      cost_line: string;
      amount_cents: string;
      period: string;
    }>(
      'select cost_line, amount_cents, period from vehicle_cost_entries where vehicle_id = $1',
      [van],
    );

    expect(entries.rowCount).toBe(1);
    expect(entries.rows[0]!.cost_line).toBe('TYRES');
    expect(entries.rows[0]!.period).toBe('ONE_OFF');
    expect(Number(entries.rows[0]!.amount_cents)).toBe(80000);
    expect(record.rowCount).toBe(1);
  });

  it('does not create one for scheduled work that has not happened', async () => {
    const van = await seedVehicle(admin, 'ECON-V3');
    await admin.query(
      `insert into maintenance_records (vehicle_id, maintenance_type, due_date, cost_cents)
       values ($1, 'SERVICE', '2027-01-01', 45000)`,
      [van],
    );

    const entries = await admin.query(
      'select id from vehicle_cost_entries where vehicle_id = $1',
      [van],
    );
    expect(entries.rowCount).toBe(0);
  });

  it('does not create one for completed work with no cost recorded', async () => {
    // An unpriced service is not a free service; it is simply not yet costed.
    const van = await seedVehicle(admin, 'ECON-V4');
    await admin.query(
      `insert into maintenance_records (vehicle_id, maintenance_type, completed_date)
       values ($1, 'INSPECTION', '2026-06-01')`,
      [van],
    );

    const entries = await admin.query(
      'select id from vehicle_cost_entries where vehicle_id = $1',
      [van],
    );
    expect(entries.rowCount).toBe(0);
  });

  it('replaces rather than duplicates when the cost is corrected', async () => {
    const van = await seedVehicle(admin, 'ECON-V5');
    const record = await admin.query<{ id: string }>(
      `insert into maintenance_records (vehicle_id, maintenance_type, completed_date, cost_cents)
       values ($1, 'REPAIR', '2026-06-01', 50000) returning id`,
      [van],
    );

    await admin.query('update maintenance_records set cost_cents = 55000 where id = $1', [
      record.rows[0]!.id,
    ]);

    const entries = await admin.query<{ amount_cents: string }>(
      'select amount_cents from vehicle_cost_entries where vehicle_id = $1',
      [van],
    );

    expect(entries.rowCount).toBe(1);
    expect(Number(entries.rows[0]!.amount_cents)).toBe(55000);
  });

  it('requires a maintenance record to say when it is due or that it is done', async () => {
    const van = await seedVehicle(admin, 'ECON-V6');
    await expect(
      admin.query(
        `insert into maintenance_records (vehicle_id, maintenance_type, description)
         values ($1, 'SERVICE', 'Someday')`,
        [van],
      ),
    ).rejects.toThrow(/has_a_trigger/i);
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
