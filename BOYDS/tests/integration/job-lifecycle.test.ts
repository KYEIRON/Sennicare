import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, seedDriverRecord, seedUser } from './helpers/db';
import { jobTypeId, seedCustomer, seedJob, seedVehicle } from './helpers/operations';
import { JOB_TRANSITIONS } from '@/services/jobs/state-machine';

/**
 * The job lifecycle, enforced by the database.
 *
 * The application validates transitions too, for clear errors. These tests
 * prove the layer beneath it: a status change that bypasses the application
 * entirely is still rejected.
 */

let admin: Client;
let customerId: string;
let typeId: string;
let driverRecordId: string;

beforeAll(async () => {
  admin = await adminClient();
  customerId = await seedCustomer(admin, 'LIFECYCLE FIXTURE');
  typeId = await jobTypeId(admin);

  // This suite seeds its own driver rather than borrowing one another test file
  // happens to have created — each file must pass on its own.
  const driverUser = await seedUser(admin, {
    email: 'lifecycle-driver@boyds.test',
    firstName: 'LifecycleDriver',
    role: 'DRIVER',
  });
  driverRecordId = await seedDriverRecord(admin, driverUser.userId);
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

async function newJob(status = 'REQUESTED'): Promise<string> {
  return seedJob(admin, { customerId, jobTypeId: typeId, status });
}

async function setStatus(jobId: string, status: string): Promise<void> {
  await admin.query('update jobs set status = $2 where id = $1', [jobId, status]);
}

/**
 * Drive a job to COMPLETED through the real lifecycle.
 *
 * Fixtures never shortcut the state machine — a job reaches a status by being
 * moved there legitimately, exactly as the application would move it.
 */
async function driveToCompleted(jobId: string, scheduledDate: string): Promise<void> {
  const vehicleId = await seedVehicle(
    admin,
    `DR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  );
  await admin.query(
    `update jobs set status = 'SCHEDULED', scheduled_date = $2,
     scheduled_time = '09:00', scheduled_window_end = '10:00' where id = $1`,
    [jobId, scheduledDate],
  );
  await admin.query(
    "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
    [jobId, vehicleId, driverRecordId],
  );

  for (const status of [
    'DRIVER_ACCEPTED',
    'EN_ROUTE_TO_PICKUP',
    'AT_PICKUP',
    'PICKED_UP',
    'IN_TRANSIT',
    'AT_DELIVERY',
    'DELIVERED',
    'POD_RECEIVED',
  ]) {
    await setStatus(jobId, status);
  }

  await admin.query('update jobs set actual_miles_tenths = 247 where id = $1', [jobId]);
  await setStatus(jobId, 'COMPLETED');
}

describe('a job may only be created at an intake status', () => {
  it.each(['REQUESTED', 'REVIEW', 'QUOTED', 'APPROVED'])('allows %s', async (status) => {
    await expect(newJob(status)).resolves.toBeTruthy();
  });

  it.each(['IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'ASSIGNED'])(
    'refuses to create a job already at %s',
    async (status) => {
      await expect(newJob(status)).rejects.toThrow(/must start at/i);
    },
  );
});

describe('illegal transitions are rejected by the database', () => {
  it('rejects COMPLETED -> REQUESTED', async () => {
    const jobId = await newJob('APPROVED');
    await driveToCompleted(jobId, '2027-03-01');

    await expect(setStatus(jobId, 'REQUESTED')).rejects.toThrow(
      /cannot move from COMPLETED to REQUESTED/i,
    );
  });

  it('rejects every other move out of COMPLETED', async () => {
    const jobId = await newJob('APPROVED');
    await driveToCompleted(jobId, '2027-03-02');

    for (const status of ['IN_TRANSIT', 'SCHEDULED', 'DELIVERED', 'CANCELLED']) {
      await expect(setStatus(jobId, status)).rejects.toThrow(
        /cannot move from COMPLETED/i,
      );
    }
  });

  it.each([
    ['REQUESTED', 'COMPLETED'],
    ['REQUESTED', 'IN_TRANSIT'],
    ['REVIEW', 'DELIVERED'],
    ['APPROVED', 'PICKED_UP'],
  ])('rejects %s -> %s', async (from, to) => {
    const jobId = await newJob(from);
    await expect(setStatus(jobId, to)).rejects.toThrow(/cannot move from/i);
  });

  it('rejects every transition out of CANCELLED', async () => {
    const jobId = await newJob('APPROVED');
    await admin.query(
      "update jobs set status = 'CANCELLED', cancellation_reason = 'Test' where id = $1",
      [jobId],
    );
    await expect(setStatus(jobId, 'SCHEDULED')).rejects.toThrow(/cannot move from/i);
  });
});

describe('transition guards', () => {
  it('refuses ASSIGNED without a vehicle and driver', async () => {
    const jobId = await newJob('APPROVED');
    await setStatus(jobId, 'SCHEDULED');
    await expect(setStatus(jobId, 'ASSIGNED')).rejects.toThrow(
      /without both a vehicle and a driver/i,
    );
  });

  it('refuses COMPLETED before actual mileage is recorded', async () => {
    const jobId = await newJob('APPROVED');
    const vehicleId = await seedVehicle(
      admin,
      `LC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    );

    await admin.query(
      `update jobs set status = 'SCHEDULED', scheduled_date = '2027-01-05',
       scheduled_time = '09:00', scheduled_window_end = '10:00' where id = $1`,
      [jobId],
    );
    await admin.query(
      "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
      [jobId, vehicleId, driverRecordId],
    );

    for (const status of [
      'DRIVER_ACCEPTED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DELIVERY',
      'DELIVERED',
      'POD_RECEIVED',
    ]) {
      await setStatus(jobId, status);
    }

    await expect(setStatus(jobId, 'COMPLETED')).rejects.toThrow(/actual mileage/i);

    await admin.query('update jobs set actual_miles_tenths = 247 where id = $1', [jobId]);
    await setStatus(jobId, 'COMPLETED');

    const result = await admin.query<{ status: string; completed_at: Date | null }>(
      'select status, completed_at from jobs where id = $1',
      [jobId],
    );
    expect(result.rows[0]!.status).toBe('COMPLETED');
    expect(result.rows[0]!.completed_at).not.toBeNull();
  });

  it('refuses cancellation without a reason', async () => {
    const jobId = await newJob('APPROVED');
    await expect(setStatus(jobId, 'CANCELLED')).rejects.toThrow(/requires a reason/i);
  });
});

describe('operational timestamps are stamped by the database', () => {
  it('records when the job was picked up, delivered and completed', async () => {
    const jobId = await newJob('APPROVED');
    const vehicleId = await seedVehicle(
      admin,
      `TS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    );

    await admin.query(
      `update jobs set status = 'SCHEDULED', scheduled_date = '2027-02-10',
       scheduled_time = '09:00', scheduled_window_end = '10:00' where id = $1`,
      [jobId],
    );
    await admin.query(
      "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
      [jobId, vehicleId, driverRecordId],
    );

    for (const status of [
      'DRIVER_ACCEPTED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DELIVERY',
      'DELIVERED',
    ]) {
      await setStatus(jobId, status);
    }

    const result = await admin.query<{
      assigned_at: Date | null;
      picked_up_at: Date | null;
      delivered_at: Date | null;
    }>('select assigned_at, picked_up_at, delivered_at from jobs where id = $1', [jobId]);

    expect(result.rows[0]!.assigned_at).not.toBeNull();
    expect(result.rows[0]!.picked_up_at).not.toBeNull();
    expect(result.rows[0]!.delivered_at).not.toBeNull();
  });
});

describe('the database and TypeScript define the same lifecycle', () => {
  it('stores exactly the transitions the application knows about', async () => {
    const result = await admin.query<{ from_status: string; to_status: string }>(
      'select from_status, to_status from job_status_transitions',
    );

    const fromDatabase = result.rows
      .map((r) => `${r.from_status}->${r.to_status}`)
      .sort();
    const fromCode = JOB_TRANSITIONS.map((t) => `${t.from}->${t.to}`).sort();

    expect(fromDatabase).toEqual(fromCode);
  });
});

describe('cost state is derived, never asserted', () => {
  it('marks a cost with an actual as ACTUAL', async () => {
    const jobId = await newJob();
    await admin.query('update jobs set fuel_cost_actual_cents = 8000 where id = $1', [
      jobId,
    ]);
    const result = await admin.query<{ fuel_cost_state: string }>(
      'select fuel_cost_state from jobs where id = $1',
      [jobId],
    );
    expect(result.rows[0]!.fuel_cost_state).toBe('ACTUAL');
  });

  it('marks an estimate-only cost as ESTIMATED', async () => {
    const jobId = await newJob();
    await admin.query('update jobs set fuel_cost_estimated_cents = 8500 where id = $1', [
      jobId,
    ]);
    const result = await admin.query<{ fuel_cost_state: string }>(
      'select fuel_cost_state from jobs where id = $1',
      [jobId],
    );
    expect(result.rows[0]!.fuel_cost_state).toBe('ESTIMATED');
  });

  it('leaves an unrecorded cost MISSING', async () => {
    const jobId = await newJob();
    const result = await admin.query<{ fuel_cost_state: string }>(
      'select fuel_cost_state from jobs where id = $1',
      [jobId],
    );
    expect(result.rows[0]!.fuel_cost_state).toBe('MISSING');
  });

  it('KEEPS the estimate when an actual is recorded', async () => {
    const jobId = await newJob();
    await admin.query('update jobs set fuel_cost_estimated_cents = 8500 where id = $1', [
      jobId,
    ]);
    await admin.query('update jobs set fuel_cost_actual_cents = 8000 where id = $1', [
      jobId,
    ]);

    const result = await admin.query<{
      fuel_cost_estimated_cents: string;
      fuel_cost_actual_cents: string;
      fuel_cost_state: string;
    }>(
      `select fuel_cost_estimated_cents, fuel_cost_actual_cents, fuel_cost_state
       from jobs where id = $1`,
      [jobId],
    );

    // The estimate survives. The variance between the two is the data that
    // eventually tells BOYD'S whether its estimating is any good.
    expect(Number(result.rows[0]!.fuel_cost_estimated_cents)).toBe(8500);
    expect(Number(result.rows[0]!.fuel_cost_actual_cents)).toBe(8000);
    expect(result.rows[0]!.fuel_cost_state).toBe('ACTUAL');
  });

  it('cannot be overridden by a caller claiming a state', async () => {
    const jobId = await newJob();
    await admin.query("update jobs set fuel_cost_state = 'ACTUAL' where id = $1", [
      jobId,
    ]);
    const result = await admin.query<{ fuel_cost_state: string }>(
      'select fuel_cost_state from jobs where id = $1',
      [jobId],
    );
    // No actual and no estimate exists, so the trigger corrects the claim.
    expect(result.rows[0]!.fuel_cost_state).toBe('MISSING');
  });
});

describe('mileage integrity', () => {
  it('rejects a loaded/empty split that does not equal the total', async () => {
    const jobId = await newJob();
    await expect(
      admin.query(
        `update jobs set actual_miles_tenths = 247, loaded_miles_tenths = 190,
         empty_miles_tenths = 30 where id = $1`,
        [jobId],
      ),
    ).rejects.toThrow(/mileage_split_consistent/i);
  });

  it('accepts a split that accounts for the total', async () => {
    const jobId = await newJob();
    await expect(
      admin.query(
        `update jobs set actual_miles_tenths = 247, loaded_miles_tenths = 190,
         empty_miles_tenths = 57 where id = $1`,
        [jobId],
      ),
    ).resolves.toBeTruthy();
  });

  it('rejects a mileage log whose odometer runs backwards', async () => {
    const vehicleId = await seedVehicle(
      admin,
      `ML-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    );
    await expect(
      admin.query(
        `insert into mileage_logs (vehicle_id, mileage_type, start_odometer_tenths, end_odometer_tenths)
         values ($1, 'LOADED', 5000, 4000)`,
        [vehicleId],
      ),
    ).rejects.toThrow(/odometer_not_decreasing/i);
  });

  it('computes miles from the odometer pair', async () => {
    const vehicleId = await seedVehicle(
      admin,
      `MC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    );
    const result = await admin.query<{ miles_tenths: number }>(
      `insert into mileage_logs (vehicle_id, mileage_type, start_odometer_tenths, end_odometer_tenths)
       values ($1, 'EMPTY', 5000, 5247) returning miles_tenths`,
      [vehicleId],
    );
    expect(result.rows[0]!.miles_tenths).toBe(247);
  });
});
