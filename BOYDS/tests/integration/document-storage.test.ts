import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedPartnerRecord,
  seedUser,
  sessionClient,
} from './helpers/db';
import { jobTypeId, seedCustomer, seedJob, seedVehicle } from './helpers/operations';

/**
 * The private document store.
 *
 * Proof of delivery, signatures and job photos are uploaded with the signed-in
 * user's own session, so they live or die by the policies on storage.objects.
 * Supabase ships that table with row level security on and no policies; before
 * migration 0026, every upload from the van would have been refused on a real
 * project, and no job could have reached POD_RECEIVED.
 *
 * These tests insert object rows directly, exactly as the storage service does
 * on the user's behalf, under the user's own session.
 */

const BUCKET = 'boyds-documents';

let admin: Client;
let partner: { authUserId: string; userId: string };
let driver: { authUserId: string; userId: string };
let otherDriver: { authUserId: string; userId: string };
let ownJobId: string;
let otherJobId: string;

async function assignedJob(
  customerId: string,
  typeId: string,
  vehicleId: string,
  driverRecordId: string,
  date: string,
): Promise<string> {
  const id = await seedJob(admin, { customerId, jobTypeId: typeId, status: 'APPROVED' });
  await admin.query(
    `update jobs set status = 'SCHEDULED', scheduled_date = $2, scheduled_time = '09:00',
     scheduled_window_end = '11:00' where id = $1`,
    [id, date],
  );
  await admin.query(
    "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
    [id, vehicleId, driverRecordId],
  );
  return id;
}

beforeAll(async () => {
  admin = await adminClient();
  const stamp = Date.now();

  partner = await seedUser(admin, {
    email: `storage-partner-${stamp}@boyds.test`,
    firstName: 'Test',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, partner.userId, 'Test Partner', 'Test Role');

  driver = await seedUser(admin, {
    email: `storage-driver-${stamp}@boyds.test`,
    firstName: 'Test',
    role: 'DRIVER',
  });
  const driverRecordId = await seedDriverRecord(admin, driver.userId);

  otherDriver = await seedUser(admin, {
    email: `storage-other-${stamp}@boyds.test`,
    firstName: 'Test',
    role: 'DRIVER',
  });
  const otherDriverRecordId = await seedDriverRecord(admin, otherDriver.userId);

  const customerId = await seedCustomer(admin, 'A Test Company');
  const typeId = await jobTypeId(admin);
  const vanA = await seedVehicle(admin, `TEST-V-ST-A-${stamp}`);
  const vanB = await seedVehicle(admin, `TEST-V-ST-B-${stamp}`);

  ownJobId = await assignedJob(customerId, typeId, vanA, driverRecordId, '2031-03-03');
  otherJobId = await assignedJob(
    customerId,
    typeId,
    vanB,
    otherDriverRecordId,
    '2031-03-03',
  );
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

let counter = 0;
const objectName = (folder: string, id: string) =>
  `${folder}/${id}/test-${(counter += 1)}-${Date.now()}.png`;

async function upload(client: Client, name: string) {
  return client.query('insert into storage.objects (bucket_id, name) values ($1, $2)', [
    BUCKET,
    name,
  ]);
}

describe('the bucket', () => {
  it('exists, is private, and enforces the application’s limits', async () => {
    const result = await admin.query<{
      public: boolean;
      file_size_limit: string;
      allowed_mime_types: string[];
    }>(
      'select public, file_size_limit, allowed_mime_types::text[] as allowed_mime_types from storage.buckets where id = $1',
      [BUCKET],
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]!.public).toBe(false);
    expect(Number(result.rows[0]!.file_size_limit)).toBe(25 * 1024 * 1024);
    expect(result.rows[0]!.allowed_mime_types).toContain('image/png');
    expect(result.rows[0]!.allowed_mime_types).not.toContain('text/html');
  });
});

describe('a driver uploads proof of delivery', () => {
  it('can upload into the folder of a job assigned to them', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await upload(client, objectName('jobs', ownJobId));
    await client.end();

    expect(result.rowCount).toBe(1);
  });

  it('can read back what is in their own job’s folder', async () => {
    const name = objectName('jobs', ownJobId);
    const client = await sessionClient(driver.authUserId);
    await upload(client, name);
    const result = await client.query(
      'select name from storage.objects where name = $1',
      [name],
    );
    await client.end();

    expect(result.rowCount).toBe(1);
  });

  it('cannot upload into another driver’s job', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(upload(client, objectName('jobs', otherJobId))).rejects.toThrow(
      /row-level security/,
    );
    await client.end();
  });

  it('cannot upload outside a job folder', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(upload(client, objectName('customers', ownJobId))).rejects.toThrow(
      /row-level security/,
    );
    await client.end();
  });

  it('cannot see another driver’s files', async () => {
    const name = objectName('jobs', otherJobId);
    await admin.query('insert into storage.objects (bucket_id, name) values ($1, $2)', [
      BUCKET,
      name,
    ]);

    const client = await sessionClient(driver.authUserId);
    const result = await client.query(
      'select name from storage.objects where name = $1',
      [name],
    );
    await client.end();

    expect(result.rowCount).toBe(0);
  });

  it('cannot delete a filed proof of delivery, even their own', async () => {
    const name = objectName('jobs', ownJobId);
    const client = await sessionClient(driver.authUserId);
    await upload(client, name);
    const result = await client.query('delete from storage.objects where name = $1', [
      name,
    ]);
    await client.end();

    expect(result.rowCount).toBe(0);

    const after = await admin.query('select 1 from storage.objects where name = $1', [
      name,
    ]);
    expect(after.rowCount).toBe(1);
  });
});

describe('a partner', () => {
  it('can read every file in the bucket', async () => {
    const name = objectName('jobs', otherJobId);
    await admin.query('insert into storage.objects (bucket_id, name) values ($1, $2)', [
      BUCKET,
      name,
    ]);

    const client = await sessionClient(partner.authUserId);
    const result = await client.query(
      'select name from storage.objects where name = $1',
      [name],
    );
    await client.end();

    expect(result.rowCount).toBe(1);
  });
});

describe('the public', () => {
  it('cannot upload anything', async () => {
    const client = await sessionClient(null);
    await expect(upload(client, objectName('jobs', ownJobId))).rejects.toThrow(
      /row-level security/,
    );
    await client.end();
  });

  it('cannot see a single file', async () => {
    const client = await sessionClient(null);
    const result = await client.query(
      'select name from storage.objects where bucket_id = $1',
      [BUCKET],
    );
    await client.end();

    expect(result.rowCount).toBe(0);
  });
});
