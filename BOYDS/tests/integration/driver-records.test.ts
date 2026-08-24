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
 * What a driver records in the field: proof of delivery, expenses and fuel.
 *
 * These tests prove the boundary holds on the new tables too — a driver may add
 * their own records and nothing else, and may not edit one after filing it.
 */

let admin: Client;
let partner: SeededUser;
let driver: SeededUser;
let otherDriver: SeededUser;
let driverRecordId: string;
let otherDriverRecordId: string;
let vehicleId: string;
let jobId: string;
let otherJobId: string;
let customerId: string;
let typeId: string;

async function assignedJob(driverId: string, date: string): Promise<string> {
  const id = await seedJob(admin, { customerId, jobTypeId: typeId, status: 'APPROVED' });
  await admin.query(
    `update jobs set status = 'SCHEDULED', scheduled_date = $2, scheduled_time = '09:00',
     scheduled_window_end = '11:00' where id = $1`,
    [id, date],
  );
  await admin.query(
    "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
    [id, vehicleId, driverId],
  );
  return id;
}

beforeAll(async () => {
  admin = await adminClient();

  partner = await seedUser(admin, {
    email: 'field-partner@boyds.test',
    firstName: 'FieldPartner',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, partner.userId, 'FieldPartner', 'Test Partner');

  driver = await seedUser(admin, {
    email: 'field-driver@boyds.test',
    firstName: 'FieldDriver',
    role: 'DRIVER',
  });
  otherDriver = await seedUser(admin, {
    email: 'field-other@boyds.test',
    firstName: 'FieldOther',
    role: 'DRIVER',
  });
  driverRecordId = await seedDriverRecord(admin, driver.userId);
  otherDriverRecordId = await seedDriverRecord(admin, otherDriver.userId);

  customerId = await seedCustomer(admin, 'FIELD FIXTURE');
  typeId = await jobTypeId(admin);
  vehicleId = await seedVehicle(admin, 'FIELD-V1');

  jobId = await assignedJob(driverRecordId, '2027-08-01');
  otherJobId = await assignedJob(otherDriverRecordId, '2027-08-02');
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('proof of delivery is required', () => {
  it('refuses POD_RECEIVED with no proof on the job', async () => {
    const id = await assignedJob(driverRecordId, '2027-08-10');
    for (const status of [
      'DRIVER_ACCEPTED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DELIVERY',
      'DELIVERED',
    ]) {
      await admin.query('update jobs set status = $2 where id = $1', [id, status]);
    }

    await expect(
      admin.query("update jobs set status = 'POD_RECEIVED' where id = $1", [id]),
    ).rejects.toThrow(/requires proof of delivery/i);
  });

  it('allows POD_RECEIVED once a signature is captured', async () => {
    const id = await assignedJob(driverRecordId, '2027-08-11');
    for (const status of [
      'DRIVER_ACCEPTED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DELIVERY',
      'DELIVERED',
    ]) {
      await admin.query('update jobs set status = $2 where id = $1', [id, status]);
    }

    await admin.query(
      `insert into documents (document_type, entity_table, entity_id, storage_path,
        file_name, mime_type, size_bytes, signed_by_name)
       values ('SIGNATURE', 'jobs', $1, $2, 'signature.png', 'image/png', 4096, 'Recipient name as given')`,
      [id, `test/${id}/signature.png`],
    );

    await expect(
      admin.query("update jobs set status = 'POD_RECEIVED' where id = $1", [id]),
    ).resolves.toBeTruthy();
  });
});

describe('a driver records their own expenses', () => {
  it('lets a driver file an expense against their own job', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents, description)
       values ($1, $2, $3, 'PARKING', 1200, 'Parking at the delivery') returning id`,
      [jobId, vehicleId, driverRecordId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('refuses an expense filed against another driver', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
         values ($1, $2, $3, 'PARKING', 1200)`,
        [otherJobId, vehicleId, otherDriverRecordId],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });

  it('shows a driver only their own expenses', async () => {
    await admin.query(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
       values ($1, $2, $3, 'TOLL', 500)`,
      [otherJobId, vehicleId, otherDriverRecordId],
    );

    const client = await sessionClient(driver.authUserId);
    const result = await client.query<{ driver_id: string }>(
      'select driver_id from job_expenses',
    );
    await client.end();

    expect(result.rows.every((r) => r.driver_id === driverRecordId)).toBe(true);
  });

  it('does not let a driver edit or delete a filed record', async () => {
    const filed = await admin.query<{ id: string; amount_cents: string }>(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
       values ($1, $2, $3, 'SUPPLIES', 2500) returning id, amount_cents`,
      [jobId, vehicleId, driverRecordId],
    );
    const expenseId = filed.rows[0]!.id;

    const client = await sessionClient(driver.authUserId);
    const updated = await client.query(
      'update job_expenses set amount_cents = 1 where id = $1',
      [expenseId],
    );
    const deleted = await client.query('delete from job_expenses where id = $1', [
      expenseId,
    ]);
    await client.end();

    // There is no UPDATE or DELETE policy for a driver on this table, so row
    // level security filters the statement to zero rows before the immutability
    // trigger is ever reached. The outcome that matters is the record: it is
    // untouched, and still there.
    expect(updated.rowCount).toBe(0);
    expect(deleted.rowCount).toBe(0);

    const after = await admin.query<{ amount_cents: string }>(
      'select amount_cents from job_expenses where id = $1',
      [expenseId],
    );
    expect(after.rowCount).toBe(1);
    expect(Number(after.rows[0]!.amount_cents)).toBe(2500);
  });

  it('DOES let a partner correct a filed record', async () => {
    const filed = await admin.query<{ id: string }>(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
       values ($1, $2, $3, 'SUPPLIES', 3000) returning id`,
      [jobId, vehicleId, driverRecordId],
    );

    const client = await sessionClient(partner.authUserId);
    const result = await client.query(
      'update job_expenses set amount_cents = 3500 where id = $1',
      [filed.rows[0]!.id],
    );
    await client.end();

    expect(result.rowCount).toBe(1);
  });

  it('rejects a zero or negative amount', async () => {
    await expect(
      admin.query(
        `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
         values ($1, $2, $3, 'PARKING', 0)`,
        [jobId, vehicleId, driverRecordId],
      ),
    ).rejects.toThrow(/amount_positive/i);
  });
});

describe('expenses roll up into the job cost', () => {
  it('sums expenses into the matching job cost column', async () => {
    const id = await assignedJob(driverRecordId, '2027-08-20');

    await admin.query(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
       values ($1, $2, $3, 'TOLL', 1500), ($1, $2, $3, 'TOLL', 500)`,
      [id, vehicleId, driverRecordId],
    );

    const result = await admin.query<{
      toll_cost_actual_cents: string;
      toll_cost_state: string;
    }>('select toll_cost_actual_cents, toll_cost_state from jobs where id = $1', [id]);

    expect(Number(result.rows[0]!.toll_cost_actual_cents)).toBe(2000);
    expect(result.rows[0]!.toll_cost_state).toBe('ACTUAL');
  });

  it('leaves a category with no expenses MISSING, not zero', async () => {
    const id = await assignedJob(driverRecordId, '2027-08-21');
    await admin.query(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
       values ($1, $2, $3, 'TOLL', 1500)`,
      [id, vehicleId, driverRecordId],
    );

    const result = await admin.query<{
      parking_cost_state: string;
      parking_cost_actual_cents: string | null;
    }>('select parking_cost_state, parking_cost_actual_cents from jobs where id = $1', [
      id,
    ]);

    // No parking receipt is not the same as no parking cost.
    expect(result.rows[0]!.parking_cost_state).toBe('MISSING');
    expect(result.rows[0]!.parking_cost_actual_cents).toBeNull();
  });

  it('recalculates when an expense is removed', async () => {
    const id = await assignedJob(driverRecordId, '2027-08-22');
    const inserted = await admin.query<{ id: string }>(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents)
       values ($1, $2, $3, 'PARKING', 800) returning id`,
      [id, vehicleId, driverRecordId],
    );

    await admin.query('delete from job_expenses where id = $1', [inserted.rows[0]!.id]);

    const result = await admin.query<{ parking_cost_state: string }>(
      'select parking_cost_state from jobs where id = $1',
      [id],
    );
    expect(result.rows[0]!.parking_cost_state).toBe('MISSING');
  });
});

describe('fuel', () => {
  it('creates the matching expense automatically', async () => {
    const id = await assignedJob(driverRecordId, '2027-09-01');

    await admin.query(
      `insert into fuel_transactions (vehicle_id, driver_id, job_id, gallons_thousandths,
        price_per_gallon_cents, total_cost_cents, odometer_tenths, station)
       values ($1, $2, $3, 11063, 374, 4138, 8341200, 'Test station')`,
      [vehicleId, driverRecordId, id],
    );

    const expenses = await admin.query<{ category: string; amount_cents: string }>(
      'select category, amount_cents from job_expenses where job_id = $1',
      [id],
    );

    expect(expenses.rowCount).toBe(1);
    expect(expenses.rows[0]!.category).toBe('FUEL');
    expect(Number(expenses.rows[0]!.amount_cents)).toBe(4138);
  });

  it('rolls the fuel cost into the job', async () => {
    const id = await assignedJob(driverRecordId, '2027-09-02');
    await admin.query(
      `insert into fuel_transactions (vehicle_id, driver_id, job_id, gallons_thousandths,
        price_per_gallon_cents, total_cost_cents)
       values ($1, $2, $3, 10000, 350, 3500)`,
      [vehicleId, driverRecordId, id],
    );

    const result = await admin.query<{
      fuel_cost_actual_cents: string;
      fuel_cost_state: string;
    }>('select fuel_cost_actual_cents, fuel_cost_state from jobs where id = $1', [id]);

    expect(Number(result.rows[0]!.fuel_cost_actual_cents)).toBe(3500);
    expect(result.rows[0]!.fuel_cost_state).toBe('ACTUAL');
  });

  it('advances the vehicle odometer but never lets it run backwards', async () => {
    const van = await seedVehicle(admin, 'FUEL-ODO');
    await admin.query(
      'update vehicles set current_odometer_tenths = 100000 where id = $1',
      [van],
    );

    await admin.query(
      `insert into fuel_transactions (vehicle_id, gallons_thousandths, price_per_gallon_cents,
        total_cost_cents, odometer_tenths) values ($1, 10000, 350, 3500, 105000)`,
      [van],
    );
    await admin.query(
      `insert into fuel_transactions (vehicle_id, gallons_thousandths, price_per_gallon_cents,
        total_cost_cents, odometer_tenths) values ($1, 10000, 350, 3500, 90000)`,
      [van],
    );

    const result = await admin.query<{ current_odometer_tenths: number }>(
      'select current_odometer_tenths from vehicles where id = $1',
      [van],
    );
    expect(result.rows[0]!.current_odometer_tenths).toBe(105000);
  });

  it('records the amount actually paid, not gallons times price', async () => {
    // 11.063 gal at $3.74 computes to $41.376. The receipt says $41.38.
    const result = await admin.query<{ total_cost_cents: string }>(
      `insert into fuel_transactions (vehicle_id, gallons_thousandths, price_per_gallon_cents,
        total_cost_cents) values ($1, 11063, 374, 4138) returning total_cost_cents`,
      [vehicleId],
    );
    expect(Number(result.rows[0]!.total_cost_cents)).toBe(4138);
  });
});

describe('documents', () => {
  it('lets a driver attach proof to their own job', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query(
      `insert into documents (document_type, entity_table, entity_id, storage_path,
        file_name, mime_type, size_bytes)
       values ('DELIVERY_PHOTO', 'jobs', $1, $2, 'photo.jpg', 'image/jpeg', 200000)
       returning id`,
      [jobId, `test/${jobId}/photo-${Math.random().toString(36).slice(2)}.jpg`],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('refuses a document attached to another driver’s job', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        `insert into documents (document_type, entity_table, entity_id, storage_path,
          file_name, mime_type, size_bytes)
         values ('DELIVERY_PHOTO', 'jobs', $1, $2, 'photo.jpg', 'image/jpeg', 200000)`,
        [otherJobId, `test/${otherJobId}/intruder.jpg`],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });

  it('rejects an oversized file', async () => {
    await expect(
      admin.query(
        `insert into documents (document_type, entity_table, entity_id, storage_path,
          file_name, mime_type, size_bytes)
         values ('RECEIPT', 'jobs', $1, $2, 'huge.jpg', 'image/jpeg', 99999999)`,
        [jobId, `test/${jobId}/huge.jpg`],
      ),
    ).rejects.toThrow(/size_sane/i);
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
