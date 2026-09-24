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
 * The audit trail.
 *
 * Written by database trigger rather than application code, so a change cannot
 * escape the log by taking a different route — a script, a direct query, or a
 * server action someone forgot to instrument.
 */

let admin: Client;
let partner: SeededUser;
let customerId: string;
let typeId: string;
let vehicleId: string;
let driverRecordId: string;

beforeAll(async () => {
  admin = await adminClient();

  partner = await seedUser(admin, {
    email: 'audit-partner@boyds.test',
    firstName: 'AuditPartner',
    role: 'PARTNER',
  });
  await admin.query(
    'insert into partners (user_id, name, role_title) values ($1, $2, $3)',
    [partner.userId, 'AuditPartner', 'Test Partner'],
  );

  const driverUser = await seedUser(admin, {
    email: 'audit-driver@boyds.test',
    firstName: 'AuditDriver',
    role: 'DRIVER',
  });
  driverRecordId = await seedDriverRecord(admin, driverUser.userId);

  customerId = await seedCustomer(admin, 'AUDIT FIXTURE');
  typeId = await jobTypeId(admin);
  vehicleId = await seedVehicle(admin, 'AUDIT-V1');
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

async function auditFor(entityId: string, action?: string) {
  const result = await admin.query<{
    action: string;
    field: string | null;
    old_value: string | null;
    new_value: string | null;
    user_id: string | null;
  }>(
    `select action, field, old_value, new_value, user_id from audit_logs
     where entity_id = $1 ${action ? 'and action = $2' : ''}
     order by created_at, id`,
    action ? [entityId, action] : [entityId],
  );
  return result.rows;
}

describe('job creation and status changes are recorded', () => {
  it('records the creation of a job', async () => {
    const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
    const rows = await auditFor(jobId, 'CREATED');
    expect(rows.length).toBe(1);
  });

  it('records a status change with the previous and new value', async () => {
    const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
    await admin.query("update jobs set status = 'REVIEW' where id = $1", [jobId]);

    const rows = await auditFor(jobId, 'STATUS_CHANGED');
    expect(rows.length).toBe(1);
    expect(rows[0]!.field).toBe('status');
    expect(rows[0]!.old_value).toBe('REQUESTED');
    expect(rows[0]!.new_value).toBe('REVIEW');
  });

  it('records every step of a lifecycle, in order', async () => {
    const jobId = await seedJob(admin, {
      customerId,
      jobTypeId: typeId,
      status: 'APPROVED',
    });
    await admin.query(
      `update jobs set status = 'SCHEDULED', scheduled_date = '2027-07-01',
       scheduled_time = '09:00', scheduled_window_end = '11:00' where id = $1`,
      [jobId],
    );
    await admin.query(
      "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
      [jobId, vehicleId, driverRecordId],
    );

    const rows = await auditFor(jobId, 'STATUS_CHANGED');
    expect(rows.map((r) => r.new_value)).toEqual(['SCHEDULED', 'ASSIGNED']);
  });
});

describe('assignment changes are recorded', () => {
  it('records the vehicle and driver assignment', async () => {
    const jobId = await seedJob(admin, {
      customerId,
      jobTypeId: typeId,
      status: 'APPROVED',
    });
    await admin.query(
      `update jobs set status = 'SCHEDULED', scheduled_date = '2027-07-02',
       scheduled_time = '09:00', scheduled_window_end = '11:00' where id = $1`,
      [jobId],
    );
    await admin.query(
      "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
      [jobId, vehicleId, driverRecordId],
    );

    const vehicleRows = await auditFor(jobId, 'VEHICLE_ASSIGNMENT_CHANGED');
    const driverRows = await auditFor(jobId, 'DRIVER_ASSIGNMENT_CHANGED');

    expect(vehicleRows.length).toBe(1);
    expect(vehicleRows[0]!.new_value).toBe(vehicleId);
    expect(driverRows.length).toBe(1);
    expect(driverRows[0]!.new_value).toBe(driverRecordId);
  });
});

describe('money and mileage changes are recorded', () => {
  it('records a price change', async () => {
    const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
    await admin.query('update jobs set won_price_cents = 30000 where id = $1', [jobId]);
    await admin.query('update jobs set won_price_cents = 32500 where id = $1', [jobId]);

    const rows = await auditFor(jobId, 'PRICE_CHANGED');
    expect(rows.length).toBe(2);
    expect(rows[1]!.old_value).toBe('30000');
    expect(rows[1]!.new_value).toBe('32500');
  });

  it('records a recorded actual cost', async () => {
    const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
    await admin.query('update jobs set fuel_cost_actual_cents = 8000 where id = $1', [
      jobId,
    ]);

    const rows = await auditFor(jobId, 'COST_RECORDED');
    expect(rows.length).toBe(1);
    expect(rows[0]!.field).toBe('fuel_cost_actual_cents');
  });

  it('records recorded mileage', async () => {
    const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
    await admin.query('update jobs set actual_miles_tenths = 247 where id = $1', [jobId]);

    const rows = await auditFor(jobId, 'MILEAGE_RECORDED');
    expect(rows.length).toBe(1);
    expect(rows[0]!.new_value).toBe('247');
  });
});

describe('who made the change', () => {
  it('records the acting user', async () => {
    const client = await sessionClient(partner.authUserId);
    const jobResult = await client.query<{ id: string }>(
      `insert into jobs (job_number, customer_id, job_type_id)
       values ($1, $2, $3) returning id`,
      [`AUDIT-WHO-${Math.random().toString(36).slice(2, 8)}`, customerId, typeId],
    );
    const jobId = jobResult.rows[0]!.id;
    await client.query("update jobs set status = 'REVIEW' where id = $1", [jobId]);
    await client.end();

    const rows = await auditFor(jobId, 'STATUS_CHANGED');
    expect(rows[0]!.user_id).toBe(partner.userId);
  });
});

describe('other entities are audited too', () => {
  it('records a customer status change', async () => {
    const id = await seedCustomer(admin, 'AUDIT CUSTOMER');
    // The fixture creates customers ACTIVE, so move to a genuinely new status.
    await admin.query("update customers set customer_status = 'ON_HOLD' where id = $1", [
      id,
    ]);

    const rows = await auditFor(id);
    expect(
      rows.some((r) => r.field === 'customer_status' && r.new_value === 'ON_HOLD'),
    ).toBe(true);
  });

  it('records a vehicle status change', async () => {
    const id = await seedVehicle(admin, 'AUDIT-V2');
    await admin.query("update vehicles set status = 'MAINTENANCE' where id = $1", [id]);

    const rows = await auditFor(id);
    expect(rows.some((r) => r.field === 'status' && r.new_value === 'MAINTENANCE')).toBe(
      true,
    );
  });
});

describe('the log ignores noise', () => {
  it('does not record a change to an unaudited field', async () => {
    const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
    const before = (await auditFor(jobId)).length;

    await admin.query(
      "update jobs set notes = 'A note that is not audited' where id = $1",
      [jobId],
    );

    expect((await auditFor(jobId)).length).toBe(before);
  });

  it('does not record an update that changed nothing', async () => {
    const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
    const before = (await auditFor(jobId)).length;

    await admin.query("update jobs set status = 'REQUESTED' where id = $1", [jobId]);

    expect((await auditFor(jobId)).length).toBe(before);
  });
});
