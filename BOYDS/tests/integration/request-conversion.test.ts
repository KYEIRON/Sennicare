import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, seedPartnerRecord, seedUser, sessionClient } from './helpers/db';
import { jobTypeId } from './helpers/operations';

/**
 * Turning an enquiry into work.
 *
 * The conversion is a partner's deliberate act. These tests exercise the exact
 * writes the server action performs, as a real session against real policies,
 * because the action's guarantees are only as good as what the database will
 * actually accept: a job created without a price, both stops copied, the
 * request closed off with a link to the job it became — and a driver unable to
 * do any of it.
 */

let admin: Client;
let partner: { authUserId: string; userId: string };
let driver: { authUserId: string; userId: string };
let sameDayId: string;

beforeAll(async () => {
  admin = await adminClient();

  const partnerUser = await seedUser(admin, {
    email: `convert-partner-${Date.now()}@boyds.test`,
    firstName: 'Test',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, partnerUser.userId, 'Test Partner', 'Test Role');
  partner = partnerUser;

  driver = await seedUser(admin, {
    email: `convert-driver-${Date.now()}@boyds.test`,
    firstName: 'Test',
    role: 'DRIVER',
  });
  await admin.query('insert into drivers (user_id) values ($1)', [driver.userId]);

  sameDayId = await jobTypeId(admin, 'SAME_DAY');
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

let requestCounter = 0;

async function seedRequest(
  overrides: { companyName?: string | null; contactName?: string | null } = {},
): Promise<string> {
  requestCounter += 1;
  const result = await admin.query<{ id: string }>(
    `insert into job_requests (
       request_number, status, source, company_name, contact_name,
       pickup_address, pickup_city, pickup_state, pickup_zip,
       delivery_address, delivery_city, delivery_state, delivery_zip,
       description
     ) values ($1, 'NEW', 'WEBSITE', $2, $3,
       '1 Test Street', 'Charlotte', 'NC', '28202',
       '2 Test Avenue', 'Concord', 'NC', '28025',
       'A pallet of test goods')
     returning id`,
    [
      `TEST-BR-${requestCounter}-${Math.random().toString(36).slice(2, 6)}`,
      overrides.companyName === undefined ? 'A Test Company' : overrides.companyName,
      overrides.contactName === undefined ? 'A Test Contact' : overrides.contactName,
    ],
  );
  return result.rows[0]!.id;
}

async function seedCustomer(): Promise<string> {
  const result = await admin.query<{ id: string }>(
    `insert into customers (customer_number, company_name, customer_type, customer_status)
     values ($1, 'A Test Company', 'BUSINESS', 'ACTIVE') returning id`,
    [`TEST-C-${Math.random().toString(36).slice(2, 10)}`],
  );
  return result.rows[0]!.id;
}

/** The writes convertRequestToJob makes, in order, as one session. */
async function convert(client: Client, requestId: string, customerId: string) {
  const job = await client.query<{
    id: string;
    status: string;
    won_price_cents: string | null;
  }>(
    `insert into jobs (job_number, customer_id, job_type_id, status, priority, source)
     values ($1, $2, $3, 'APPROVED', 'STANDARD', 'WEBSITE')
     returning id, status, won_price_cents`,
    [`TEST-J-CONV-${Math.random().toString(36).slice(2, 8)}`, customerId, sameDayId],
  );
  const jobId = job.rows[0]!.id;

  await client.query(
    `insert into job_stops (job_id, sequence, stop_type, address_line1, city, state, zip)
     values ($1, 1, 'PICKUP', '1 Test Street', 'Charlotte', 'NC', '28202'),
            ($1, 2, 'DELIVERY', '2 Test Avenue', 'Concord', 'NC', '28025')`,
    [jobId],
  );

  await client.query(
    `update job_requests
        set status = 'CONVERTED', converted_job_id = $2, customer_id = $3,
            reviewed_by = $4, reviewed_at = now()
      where id = $1`,
    [requestId, jobId, customerId, partner.userId],
  );

  return job.rows[0]!;
}

describe('a partner converts a request into a job', () => {
  it('creates the job at APPROVED with no price', async () => {
    const requestId = await seedRequest();
    const customerId = await seedCustomer();
    const client = await sessionClient(partner.authUserId);

    const job = await convert(client, requestId, customerId);
    await client.end();

    expect(job.status).toBe('APPROVED');
    // Not zero. The enquiry carried no agreed price, and a job priced at
    // nothing would report itself as pure loss the moment a cost landed on it.
    expect(job.won_price_cents).toBeNull();
  });

  it('copies both stops', async () => {
    const requestId = await seedRequest();
    const customerId = await seedCustomer();
    const client = await sessionClient(partner.authUserId);

    const job = await convert(client, requestId, customerId);
    const stops = await client.query<{ stop_type: string; city: string }>(
      'select stop_type, city from job_stops where job_id = $1 order by sequence',
      [job.id],
    );
    await client.end();

    expect(stops.rows.map((row) => row.stop_type)).toEqual(['PICKUP', 'DELIVERY']);
    expect(stops.rows.map((row) => row.city)).toEqual(['Charlotte', 'Concord']);
  });

  it('closes the request off with a link to the job it became', async () => {
    const requestId = await seedRequest();
    const customerId = await seedCustomer();
    const client = await sessionClient(partner.authUserId);

    const job = await convert(client, requestId, customerId);
    await client.end();

    const result = await admin.query<{
      status: string;
      converted_job_id: string;
      reviewed_by: string;
    }>('select status, converted_job_id, reviewed_by from job_requests where id = $1', [
      requestId,
    ]);

    expect(result.rows[0]!.status).toBe('CONVERTED');
    expect(result.rows[0]!.converted_job_id).toBe(job.id);
    expect(result.rows[0]!.reviewed_by).toBe(partner.userId);
  });
});

describe('the database refuses a half-finished conversion', () => {
  it('will not mark a request CONVERTED without the job it became', async () => {
    const requestId = await seedRequest();
    await expect(
      admin.query("update job_requests set status = 'CONVERTED' where id = $1", [
        requestId,
      ]),
    ).rejects.toThrow(/job_requests_converted_has_job/);
  });

  it('will not decline a request without a reason', async () => {
    const requestId = await seedRequest();
    await expect(
      admin.query("update job_requests set status = 'DECLINED' where id = $1", [
        requestId,
      ]),
    ).rejects.toThrow(/job_requests_declined_has_reason/);
  });

  it('accepts a decline that carries one', async () => {
    const requestId = await seedRequest();
    const client = await sessionClient(partner.authUserId);
    await client.query(
      `update job_requests
          set status = 'DECLINED', declined_reason = $2, reviewed_by = $3, reviewed_at = now()
        where id = $1`,
      [requestId, 'Outside the area BOYD’S covers.', partner.userId],
    );
    await client.end();

    const result = await admin.query<{ status: string; declined_reason: string }>(
      'select status, declined_reason from job_requests where id = $1',
      [requestId],
    );
    expect(result.rows[0]!.status).toBe('DECLINED');
    expect(result.rows[0]!.declined_reason).toContain('Outside the area');
  });
});

describe('a driver cannot convert or decline a request', () => {
  it('cannot create the job', async () => {
    const customerId = await seedCustomer();
    const client = await sessionClient(driver.authUserId);

    await expect(
      client.query(
        `insert into jobs (job_number, customer_id, job_type_id, status, priority, source)
         values ($1, $2, $3, 'APPROVED', 'STANDARD', 'WEBSITE')`,
        [`TEST-J-DRV-${Math.random().toString(36).slice(2, 8)}`, customerId, sameDayId],
      ),
    ).rejects.toThrow(/row-level security/);

    await client.end();
  });

  it('cannot decline the request', async () => {
    const requestId = await seedRequest();
    const client = await sessionClient(driver.authUserId);

    const result = await client.query(
      `update job_requests
          set status = 'DECLINED', declined_reason = 'Not a driver’s call'
        where id = $1`,
      [requestId],
    );
    await client.end();

    // Row level security makes the row invisible rather than raising: the
    // update matches nothing, so the request is untouched.
    expect(result.rowCount).toBe(0);

    const after = await admin.query<{ status: string }>(
      'select status from job_requests where id = $1',
      [requestId],
    );
    expect(after.rows[0]!.status).toBe('NEW');
  });
});
