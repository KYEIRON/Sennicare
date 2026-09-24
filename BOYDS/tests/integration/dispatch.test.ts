import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, seedDriverRecord, seedUser } from './helpers/db';
import { jobTypeId, seedCustomer, seedJob, seedVehicle } from './helpers/operations';

/**
 * Dispatch, enforced by the database.
 *
 * Double booking, conflicting times and inactive resources are rejected at the
 * layer beneath the application, so a bug in a server action cannot commit
 * BOYD'S to work it physically cannot do.
 */

let admin: Client;
let customerId: string;
let typeId: string;
let vanA: string;
let vanB: string;
let driverA: string;
let driverB: string;

beforeAll(async () => {
  admin = await adminClient();
  customerId = await seedCustomer(admin, 'DISPATCH FIXTURE');
  typeId = await jobTypeId(admin);

  vanA = await seedVehicle(admin, 'DISPATCH-A');
  vanB = await seedVehicle(admin, 'DISPATCH-B');

  const userA = await seedUser(admin, {
    email: 'dispatch-driver-a@boyds.test',
    firstName: 'DispatchA',
    role: 'DRIVER',
  });
  const userB = await seedUser(admin, {
    email: 'dispatch-driver-b@boyds.test',
    firstName: 'DispatchB',
    role: 'DRIVER',
  });
  driverA = await seedDriverRecord(admin, userA.userId);
  driverB = await seedDriverRecord(admin, userB.userId);
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

async function scheduledJob(date: string, time: string, end: string): Promise<string> {
  const jobId = await seedJob(admin, {
    customerId,
    jobTypeId: typeId,
    status: 'APPROVED',
  });
  await admin.query(
    `update jobs set status = 'SCHEDULED', scheduled_date = $2, scheduled_time = $3,
     scheduled_window_end = $4 where id = $1`,
    [jobId, date, time, end],
  );
  return jobId;
}

async function assign(jobId: string, vehicleId: string, driverId: string) {
  return admin.query(
    "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
    [jobId, vehicleId, driverId],
  );
}

describe('double booking is prevented', () => {
  it('refuses the same vehicle in an overlapping window', async () => {
    const first = await scheduledJob('2027-04-01', '09:00', '11:00');
    const second = await scheduledJob('2027-04-01', '10:00', '12:00');

    await assign(first, vanA, driverA);
    await expect(assign(second, vanA, driverB)).rejects.toThrow(/VEHICLE_DOUBLE_BOOKED/);
  });

  it('refuses the same driver in an overlapping window', async () => {
    const first = await scheduledJob('2027-04-02', '09:00', '11:00');
    const second = await scheduledJob('2027-04-02', '10:00', '12:00');

    await assign(first, vanA, driverA);
    await expect(assign(second, vanB, driverA)).rejects.toThrow(/DRIVER_DOUBLE_BOOKED/);
  });

  it('allows a second job at a non-overlapping time', async () => {
    const morning = await scheduledJob('2027-04-03', '08:00', '10:00');
    const afternoon = await scheduledJob('2027-04-03', '13:00', '15:00');

    await assign(morning, vanA, driverA);
    await expect(assign(afternoon, vanA, driverA)).resolves.toBeTruthy();
  });

  it('allows back-to-back jobs — a window end is exclusive', async () => {
    const first = await scheduledJob('2027-04-04', '08:00', '10:00');
    const second = await scheduledJob('2027-04-04', '10:00', '12:00');

    await assign(first, vanA, driverA);
    await expect(assign(second, vanA, driverA)).resolves.toBeTruthy();
  });

  it('scales beyond one van — a second van takes the overlapping job', async () => {
    const first = await scheduledJob('2027-04-05', '09:00', '11:00');
    const second = await scheduledJob('2027-04-05', '09:30', '11:30');

    await assign(first, vanA, driverA);
    await expect(assign(second, vanB, driverB)).resolves.toBeTruthy();
  });

  it('frees the resources once a job is cancelled', async () => {
    const first = await scheduledJob('2027-04-06', '09:00', '11:00');
    const second = await scheduledJob('2027-04-06', '09:30', '11:30');

    await assign(first, vanA, driverA);
    await admin.query(
      "update jobs set status = 'CANCELLED', cancellation_reason = 'Customer withdrew' where id = $1",
      [first],
    );

    await expect(assign(second, vanA, driverA)).resolves.toBeTruthy();
  });
});

describe('inactive resources cannot be assigned', () => {
  it.each(['MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'])(
    'refuses a vehicle that is %s',
    async (status) => {
      const van = await seedVehicle(admin, `MNT-${status.replace(/_/g, '')}`, { status });
      const jobId = await scheduledJob('2027-05-01', '09:00', '11:00');

      await expect(assign(jobId, van, driverA)).rejects.toThrow(/VEHICLE_UNAVAILABLE/);
    },
  );

  it('refuses an inactive vehicle', async () => {
    const van = await seedVehicle(admin, 'INACTIVE-VAN', { active: false });
    const jobId = await scheduledJob('2027-05-02', '09:00', '11:00');
    await expect(assign(jobId, van, driverA)).rejects.toThrow(/VEHICLE_UNAVAILABLE/);
  });

  it('refuses a suspended driver', async () => {
    const user = await seedUser(admin, {
      email: 'suspended-driver@boyds.test',
      firstName: 'SuspendedDriver',
      role: 'DRIVER',
    });
    const suspended = await seedDriverRecord(admin, user.userId);
    await admin.query("update drivers set status = 'SUSPENDED' where id = $1", [
      suspended,
    ]);

    const jobId = await scheduledJob('2027-05-03', '09:00', '11:00');
    await expect(assign(jobId, vanA, suspended)).rejects.toThrow(/DRIVER_UNAVAILABLE/);
  });

  it('refuses a driver marked unavailable', async () => {
    const user = await seedUser(admin, {
      email: 'unavailable-driver@boyds.test',
      firstName: 'UnavailableDriver',
      role: 'DRIVER',
    });
    const unavailable = await seedDriverRecord(admin, user.userId);
    await admin.query("update drivers set availability = 'UNAVAILABLE' where id = $1", [
      unavailable,
    ]);

    const jobId = await scheduledJob('2027-05-04', '09:00', '11:00');
    await expect(assign(jobId, vanA, unavailable)).rejects.toThrow(/DRIVER_UNAVAILABLE/);
  });
});

describe('vehicle and driver state follows job activity', () => {
  it('marks the vehicle ASSIGNED and the driver ON_JOB', async () => {
    const van = await seedVehicle(admin, 'STATE-A');
    const jobId = await scheduledJob('2027-06-01', '09:00', '11:00');
    await assign(jobId, van, driverB);

    const vehicle = await admin.query<{ status: string }>(
      'select status from vehicles where id = $1',
      [van],
    );
    const driver = await admin.query<{ availability: string }>(
      'select availability from drivers where id = $1',
      [driverB],
    );

    expect(vehicle.rows[0]!.status).toBe('ASSIGNED');
    expect(driver.rows[0]!.availability).toBe('ON_JOB');
  });

  it('marks the vehicle IN_TRANSIT once the job is moving', async () => {
    const van = await seedVehicle(admin, 'STATE-B');
    const user = await seedUser(admin, {
      email: 'transit-driver@boyds.test',
      firstName: 'TransitDriver',
      role: 'DRIVER',
    });
    const transitDriver = await seedDriverRecord(admin, user.userId);

    const jobId = await scheduledJob('2027-06-02', '09:00', '11:00');
    await assign(jobId, van, transitDriver);

    for (const status of ['DRIVER_ACCEPTED', 'EN_ROUTE_TO_PICKUP']) {
      await admin.query('update jobs set status = $2 where id = $1', [jobId, status]);
    }

    const vehicle = await admin.query<{ status: string }>(
      'select status from vehicles where id = $1',
      [van],
    );
    expect(vehicle.rows[0]!.status).toBe('IN_TRANSIT');
  });

  it('releases the vehicle and driver when the job closes', async () => {
    const van = await seedVehicle(admin, 'STATE-C');
    const user = await seedUser(admin, {
      email: 'release-driver@boyds.test',
      firstName: 'ReleaseDriver',
      role: 'DRIVER',
    });
    const releaseDriver = await seedDriverRecord(admin, user.userId);

    const jobId = await scheduledJob('2027-06-03', '09:00', '11:00');
    await assign(jobId, van, releaseDriver);
    await admin.query(
      "update jobs set status = 'CANCELLED', cancellation_reason = 'Test release' where id = $1",
      [jobId],
    );

    const vehicle = await admin.query<{ status: string }>(
      'select status from vehicles where id = $1',
      [van],
    );
    const driver = await admin.query<{ availability: string }>(
      'select availability from drivers where id = $1',
      [releaseDriver],
    );

    expect(vehicle.rows[0]!.status).toBe('AVAILABLE');
    expect(driver.rows[0]!.availability).toBe('AVAILABLE');
  });

  it('does not drag a vehicle out of MAINTENANCE', async () => {
    const van = await seedVehicle(admin, 'STATE-D');
    const jobId = await scheduledJob('2027-06-04', '09:00', '11:00');
    await assign(jobId, van, driverA);

    await admin.query("update vehicles set status = 'MAINTENANCE' where id = $1", [van]);
    await admin.query("update jobs set status = 'DRIVER_ACCEPTED' where id = $1", [
      jobId,
    ]);

    const vehicle = await admin.query<{ status: string }>(
      'select status from vehicles where id = $1',
      [van],
    );
    expect(vehicle.rows[0]!.status).toBe('MAINTENANCE');
  });
});

describe('vehicle status is operational, not editorial', () => {
  it('refuses a hand-set ASSIGNED or IN_TRANSIT', async () => {
    const van = await seedVehicle(admin, 'EDIT-A');

    for (const status of ['ASSIGNED', 'IN_TRANSIT']) {
      await expect(
        admin.query('update vehicles set status = $2 where id = $1', [van, status]),
      ).rejects.toThrow(/set by job activity, not by editing/i);
    }
  });

  it('allows a partner to set the states that describe the vehicle itself', async () => {
    const van = await seedVehicle(admin, 'EDIT-B');
    for (const status of ['MAINTENANCE', 'OUT_OF_SERVICE', 'AVAILABLE', 'INACTIVE']) {
      await expect(
        admin.query('update vehicles set status = $2 where id = $1', [van, status]),
      ).resolves.toBeTruthy();
    }
  });

  it('records every status change in the vehicle history', async () => {
    const van = await seedVehicle(admin, 'HIST-A');
    await admin.query("update vehicles set status = 'MAINTENANCE' where id = $1", [van]);
    await admin.query("update vehicles set status = 'AVAILABLE' where id = $1", [van]);

    const history = await admin.query<{ to_status: string }>(
      'select to_status from vehicle_status_history where vehicle_id = $1 order by changed_at',
      [van],
    );
    expect(history.rows.map((r) => r.to_status)).toEqual(['MAINTENANCE', 'AVAILABLE']);
  });
});
