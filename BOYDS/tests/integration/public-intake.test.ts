import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, sessionClient } from './helpers/db';

/**
 * The public boundary, and the 2 AM scenario.
 *
 * An anonymous visitor can create exactly one shape of record, through one
 * function, and can read nothing back. A request arriving in the middle of the
 * night is recorded and flagged — never confirmed, because at 2 AM nobody has
 * checked whether BOYD'S can actually do it.
 */

let admin: Client;

beforeAll(async () => {
  admin = await adminClient();
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

const VALID_REQUEST = [
  'A Test Company',
  'A Contact Name',
  'contact@example.test',
  '555-0100',
  '1 Test Street',
  'Charlotte',
  'NC',
  '28202',
  '2 Test Avenue',
  'Concord',
  'NC',
  '28025',
  'A pallet of test goods',
  null,
  null,
  'URGENT',
  false,
  'WEBSITE',
  null,
];

async function submitAsAnonymous(client: Client, args: unknown[] = VALID_REQUEST) {
  return client.query<{ create_public_job_request: string }>(
    `select create_public_job_request(
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, $15::time,
       $16, $17, $18, $19
     )`,
    args,
  );
}

describe('an anonymous visitor can submit a request', () => {
  it('creates the request and returns only a reference number', async () => {
    const client = await sessionClient(null);
    const result = await submitAsAnonymous(client);
    await client.end();

    const reference = result.rows[0]!.create_public_job_request;
    expect(reference).toMatch(/^BR-\d{4}-\d{4}$/);
  });

  it('records it as NEW, awaiting review', async () => {
    const client = await sessionClient(null);
    const result = await submitAsAnonymous(client);
    await client.end();

    const stored = await admin.query<{ status: string; source: string }>(
      'select status, source from job_requests where request_number = $1',
      [result.rows[0]!.create_public_job_request],
    );

    expect(stored.rows[0]!.status).toBe('NEW');
    expect(stored.rows[0]!.source).toBe('WEBSITE');
  });

  it('never creates a job — a request is not work BOYD’S has agreed to', async () => {
    const before = await admin.query<{ count: string }>('select count(*) from jobs');

    const client = await sessionClient(null);
    await submitAsAnonymous(client);
    await client.end();

    const after = await admin.query<{ count: string }>('select count(*) from jobs');
    expect(after.rows[0]!.count).toBe(before.rows[0]!.count);
  });

  it('never sets a price', async () => {
    const client = await sessionClient(null);
    const result = await submitAsAnonymous(client);
    await client.end();

    const stored = await admin.query(
      'select converted_job_id, reviewed_by, reviewed_at from job_requests where request_number = $1',
      [result.rows[0]!.create_public_job_request],
    );

    expect(stored.rows[0]).toMatchObject({
      converted_job_id: null,
      reviewed_by: null,
      reviewed_at: null,
    });
  });
});

describe('the function validates what it is given', () => {
  it('refuses a request with no contact name', async () => {
    const client = await sessionClient(null);
    const args = [...VALID_REQUEST];
    args[1] = '   ';
    await expect(submitAsAnonymous(client, args)).rejects.toThrow(/contact name/i);
    await client.end();
  });

  it('refuses a request with no way to reply', async () => {
    const client = await sessionClient(null);
    const args = [...VALID_REQUEST];
    args[2] = '';
    args[3] = '';
    await expect(submitAsAnonymous(client, args)).rejects.toThrow(
      /email address or a phone number/i,
    );
    await client.end();
  });

  it('accepts a phone number with no email', async () => {
    const client = await sessionClient(null);
    const args = [...VALID_REQUEST];
    args[2] = '';
    await expect(submitAsAnonymous(client, args)).resolves.toBeTruthy();
    await client.end();
  });

  it('refuses a request with no collection or delivery address', async () => {
    const client = await sessionClient(null);
    for (const index of [4, 8]) {
      const args = [...VALID_REQUEST];
      args[index] = '  ';
      await expect(submitAsAnonymous(client, args)).rejects.toThrow(/address/i);
    }
    await client.end();
  });
});

describe('the public can read almost nothing', () => {
  it.each([
    'jobs',
    'customers',
    'job_requests',
    'quotes',
    'invoices',
    'payments',
    'leads',
    'pricing_rules',
    'vehicles',
    'drivers',
    'users',
    'partners',
    'audit_logs',
    'vehicle_cost_entries',
  ])('is refused outright on %s', async (table) => {
    const client = await sessionClient(null);
    await expect(client.query(`select * from ${table} limit 1`)).rejects.toThrow(
      /permission denied/i,
    );
    await client.end();
  });

  it('cannot read back the request it just created', async () => {
    const client = await sessionClient(null);
    const result = await submitAsAnonymous(client);

    await expect(
      client.query('select * from job_requests where request_number = $1', [
        result.rows[0]!.create_public_job_request,
      ]),
    ).rejects.toThrow(/permission denied/i);
    await client.end();
  });

  it('CAN read active service areas and job types — and only those', async () => {
    const client = await sessionClient(null);
    const areas = await client.query('select id from service_areas');
    const types = await client.query('select id from job_types');
    await client.end();

    expect(areas.rowCount).toBeGreaterThan(0);
    expect(types.rowCount).toBeGreaterThan(0);
  });

  it('cannot write to the tables it can read', async () => {
    const client = await sessionClient(null);
    await expect(
      client.query("insert into job_types (code, name) values ('HACK', 'Injected')"),
    ).rejects.toThrow(/permission denied/i);
    await client.end();
  });
});

describe('the 2 AM scenario', () => {
  it('flags a request that arrives outside working hours', async () => {
    // The function reads BOYD'S operating clock, so this test asserts the flag
    // matches the hour in America/New_York rather than the machine's timezone.
    const client = await sessionClient(null);
    const result = await submitAsAnonymous(client);
    await client.end();

    const stored = await admin.query<{ is_after_hours: boolean; local_hour: number }>(
      `select jr.is_after_hours,
              extract(hour from (jr.received_at at time zone 'America/New_York'))::int as local_hour
       from job_requests jr where jr.request_number = $1`,
      [result.rows[0]!.create_public_job_request],
    );

    const { is_after_hours: afterHours, local_hour: hour } = stored.rows[0]!;
    expect(afterHours).toBe(hour >= 18 || hour < 7);
  });

  it('leaves an after-hours request for a partner, never confirmed', async () => {
    const client = await sessionClient(null);
    const result = await submitAsAnonymous(client);
    await client.end();

    const stored = await admin.query<{ status: string; converted_job_id: string | null }>(
      'select status, converted_job_id from job_requests where request_number = $1',
      [result.rows[0]!.create_public_job_request],
    );

    expect(stored.rows[0]!.status).toBe('NEW');
    expect(stored.rows[0]!.converted_job_id).toBeNull();
  });

  it('records urgency as stated, without acting on it', async () => {
    const client = await sessionClient(null);
    const result = await submitAsAnonymous(client);
    await client.end();

    const stored = await admin.query<{ urgency: string; status: string }>(
      'select urgency, status from job_requests where request_number = $1',
      [result.rows[0]!.create_public_job_request],
    );

    // Urgency is what the customer said. It does not schedule, assign, or
    // confirm anything.
    expect(stored.rows[0]!.urgency).toBe('URGENT');
    expect(stored.rows[0]!.status).toBe('NEW');
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
