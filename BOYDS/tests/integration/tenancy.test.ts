import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  organisationId,
  seedOrganisation,
  seedPartnerRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { jobTypeId, seedCustomer, seedVehicle } from './helpers/operations';

/**
 * Phase 2, milestone 1: every record belongs to exactly one company, and the
 * database — not the application — keeps one company's records from pointing
 * at another's.
 *
 * Row level security scoped by company is milestone 2. These tests prove the
 * structural half: ownership, inheritance, cross-company references and
 * reference numbers.
 *
 * The second company here is synthetic and exists only in the test database.
 */

let admin: Client;
let boyds: string;
let other: string;
let otherJobType: string;
let partner: SeededUser;
let driver: SeededUser;

const unique = () => Math.random().toString(36).slice(2, 8);

beforeAll(async () => {
  admin = await adminClient();
  boyds = await organisationId(admin);
  other = await seedOrganisation(admin, `other-${unique()}`, { referencePrefix: 'Z' });

  const type = await admin.query<{ id: string }>(
    `insert into job_types (organisation_id, code, name)
     values ($1, 'SAME_DAY', 'Same-day (test company)') returning id`,
    [other],
  );
  otherJobType = type.rows[0]!.id;

  partner = await seedUser(admin, {
    email: `tenancy-partner-${unique()}@boyds.test`,
    firstName: 'Tenancy Partner',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, partner.userId, 'Tenancy Partner', 'Test');

  driver = await seedUser(admin, {
    email: `tenancy-driver-${unique()}@boyds.test`,
    firstName: 'Tenancy Driver',
    role: 'DRIVER',
  });
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('every business record belongs to a company', () => {
  it('has a required company on every table except the shared reference lists', async () => {
    const result = await admin.query<{ relname: string }>(
      `select c.relname
         from pg_class c
        where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
          and c.relname not in ('organisations', 'industries', 'job_status_transitions')
          and not exists (select 1 from pg_attribute a
                           where a.attrelid = c.oid and a.attname = 'organisation_id'
                             and a.attnotnull and not a.attisdropped)`,
    );
    expect(result.rows).toEqual([]);
  });

  it('refuses a top-level record when no company can be determined', async () => {
    // A superuser connection with nobody signed in: no parent, no session.
    await expect(
      admin.query(
        `insert into customers (customer_number, company_name) values ($1, 'Nobody''s')`,
        [`TEST-C-${unique()}`],
      ),
    ).rejects.toThrow(/needs a company/);
  });

  it('gives a signed-in partner’s new customer the partner’s company', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query<{ organisation_id: string }>(
      `insert into customers (customer_number, company_name)
       values ($1, 'Made By A Partner') returning organisation_id`,
      [`TEST-C-${unique()}`],
    );
    await client.end();
    expect(result.rows[0]!.organisation_id).toBe(boyds);
  });

  it('gives a child record its parent’s company', async () => {
    const customer = await seedCustomer(admin, 'OTHER CO PARENT', other);
    const contact = await admin.query<{ organisation_id: string }>(
      `insert into customer_contacts (customer_id, name)
       values ($1, 'A Contact') returning organisation_id`,
      [customer],
    );
    expect(contact.rows[0]!.organisation_id).toBe(other);
  });
});

describe('no record can point at another company’s record', () => {
  it('refuses a job for one company’s customer filed under another', async () => {
    const theirCustomer = await seedCustomer(admin, 'OTHER CO CUSTOMER', other);
    await expect(
      admin.query(
        `insert into jobs (organisation_id, job_number, customer_id, job_type_id)
         values ($1, $2, $3, $4)`,
        [boyds, `TEST-J-${unique()}`, theirCustomer, await jobTypeId(admin)],
      ),
    ).rejects.toThrow(/same_org_fkey/);
  });

  it('refuses a job that mixes one company’s customer with another’s job type', async () => {
    const theirCustomer = await seedCustomer(admin, 'OTHER CO MIXED', other);
    await expect(
      admin.query(
        `insert into jobs (job_number, customer_id, job_type_id) values ($1, $2, $3)`,
        [`TEST-J-${unique()}`, theirCustomer, await jobTypeId(admin)],
      ),
    ).rejects.toThrow(/same_org_fkey/);
  });

  it('refuses assigning another company’s van to a job', async () => {
    const ourCustomer = await seedCustomer(admin, 'BOYDS CO VAN TEST');
    const theirVan = await seedVehicle(admin, `TEST-V-${unique().toUpperCase()}`, {
      organisationId: other,
    });
    await expect(
      admin.query(
        `insert into jobs (job_number, customer_id, job_type_id, vehicle_id)
         values ($1, $2, $3, $4)`,
        [`TEST-J-${unique()}`, ourCustomer, await jobTypeId(admin), theirVan],
      ),
    ).rejects.toThrow(/same_org_fkey/);
  });

  it('refuses moving a record to another company after the fact', async () => {
    const customer = await seedCustomer(admin, 'BOYDS CO MOVE TEST');
    await admin.query(
      `insert into customer_contacts (customer_id, name) values ($1, 'Stays Put')`,
      [customer],
    );
    await expect(
      admin.query('update customers set organisation_id = $1 where id = $2', [
        other,
        customer,
      ]),
    ).rejects.toThrow(/same_org_fkey/);
  });

  it('accepts a job whose every reference is in the same company', async () => {
    const theirCustomer = await seedCustomer(admin, 'OTHER CO WHOLE', other);
    const result = await admin.query<{ organisation_id: string }>(
      `insert into jobs (job_number, customer_id, job_type_id)
       values ($1, $2, $3) returning organisation_id`,
      [`TEST-J-${unique()}`, theirCustomer, otherJobType],
    );
    expect(result.rows[0]!.organisation_id).toBe(other);
  });

  it('has a same-company guard on every reference between company tables', async () => {
    const result = await admin.query<{ ref: string }>(
      `select c.conrelid::regclass::text || '.' || a.attname as ref
         from pg_constraint c
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f'
          and c.connamespace = 'public'::regnamespace
          and array_length(c.conkey, 1) = 1
          and a.attname <> 'organisation_id'
          and exists (select 1 from pg_attribute x where x.attrelid = c.conrelid
                         and x.attname = 'organisation_id' and not x.attisdropped)
          and exists (select 1 from pg_attribute y where y.attrelid = c.confrelid
                         and y.attname = 'organisation_id' and not y.attisdropped)
          and not exists (select 1 from pg_constraint t
                           where t.contype = 'f' and t.conrelid = c.conrelid
                             and t.confrelid = c.confrelid
                             and array_length(t.conkey, 1) = 2
                             and t.conkey[1] = c.conkey[1])`,
    );
    expect(result.rows).toEqual([]);
  });
});

describe('reference numbers belong to a company', () => {
  it('lets two companies each hold the same customer number', async () => {
    const number = `TEST-SHARED-${unique()}`;
    await admin.query(
      `insert into customers (organisation_id, customer_number, company_name) values ($1, $2, 'A')`,
      [boyds, number],
    );
    await expect(
      admin.query(
        `insert into customers (organisation_id, customer_number, company_name) values ($1, $2, 'B')`,
        [other, number],
      ),
    ).resolves.toBeTruthy();
  });

  it('still refuses a duplicate within one company', async () => {
    const number = `TEST-DUP-${unique()}`;
    await admin.query(
      `insert into customers (organisation_id, customer_number, company_name) values ($1, $2, 'A')`,
      [boyds, number],
    );
    await expect(
      admin.query(
        `insert into customers (organisation_id, customer_number, company_name) values ($1, $2, 'B')`,
        [boyds, number],
      ),
    ).rejects.toThrow(/per_org_key/);
  });

  it('numbers a new company from 1, with its own prefix', async () => {
    const fresh = await seedOrganisation(admin, `fresh-${unique()}`, {
      referencePrefix: 'Q',
    });
    const year = new Date().getFullYear();
    const first = await admin.query<{ n: string }>(
      `select issue_reference_number($1, 'JOB') as n`,
      [fresh],
    );
    const customer = await admin.query<{ n: string }>(
      `select issue_reference_number($1, 'CUSTOMER') as n`,
      [fresh],
    );
    // The year is the company's own; around midnight on 31 December the test
    // machine's year may differ, so accept either side.
    expect(first.rows[0]!.n).toMatch(
      new RegExp(`^QJ-(${year - 1}|${year}|${year + 1})-0001$`),
    );
    expect(customer.rows[0]!.n).toBe('QC-0001');
  });

  it('never gives another company’s count away', async () => {
    // BOYD'S issuing numbers does not move another company's counter.
    const fresh = await seedOrganisation(admin, `quiet-${unique()}`, {
      referencePrefix: 'W',
    });
    await admin.query(`select issue_reference_number($1, 'LEAD')`, [boyds]);
    await admin.query(`select issue_reference_number($1, 'LEAD')`, [boyds]);
    const theirs = await admin.query<{ n: string }>(
      `select issue_reference_number($1, 'LEAD') as n`,
      [fresh],
    );
    expect(theirs.rows[0]!.n).toBe('WL-0001');
  });

  it('never issues the same number twice under concurrent load', async () => {
    const clients = await Promise.all(Array.from({ length: 8 }, () => adminClient()));
    try {
      const batches = await Promise.all(
        clients.map(async (client) => {
          const numbers: string[] = [];
          for (let i = 0; i < 10; i += 1) {
            const result = await client.query<{ n: string }>(
              `select issue_reference_number($1, 'QUOTE') as n`,
              [boyds],
            );
            numbers.push(result.rows[0]!.n);
          }
          return numbers;
        }),
      );
      const all = batches.flat();
      expect(new Set(all).size).toBe(all.length);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it('keeps growing past 9999 instead of truncating', async () => {
    const big = await seedOrganisation(admin, `big-${unique()}`, {
      referencePrefix: 'V',
    });
    await admin.query(
      `insert into organisation_counters (organisation_id, kind, period, last_value)
       values ($1, 'CUSTOMER', 0, 9999)`,
      [big],
    );
    const result = await admin.query<{ n: string }>(
      `select issue_reference_number($1, 'CUSTOMER') as n`,
      [big],
    );
    expect(result.rows[0]!.n).toBe('VC-10000');
  });

  it('gives incident reports their own code, distinct from invoices', async () => {
    const result = await admin.query<{ n: string }>(
      `select issue_reference_number($1, 'INCIDENT') as n`,
      [boyds],
    );
    expect(result.rows[0]!.n).toMatch(/^BIR-\d{4}-\d{4}$/);
  });

  it('refuses a kind of number it does not know', async () => {
    await expect(
      admin.query(`select issue_reference_number($1, 'NONSENSE')`, [boyds]),
    ).rejects.toThrow(/Unknown kind/);
  });

  it('cannot be called directly by any api role', async () => {
    for (const role of ['anon', 'authenticated']) {
      const result = await admin.query<{ has: boolean }>(
        `select has_function_privilege($1, 'issue_reference_number(uuid, text)', 'execute') as has`,
        [role],
      );
      expect(result.rows[0]!.has).toBe(false);
    }
  });

  it('lets a partner take the next number for their own company only', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query<{ n: string }>(
      `select next_reference_number('CUSTOMER') as n`,
    );
    await client.end();
    expect(result.rows[0]!.n).toMatch(/^BC-\d{4,}$/);
  });

  it('refuses a driver a reference number', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(client.query(`select next_reference_number('JOB')`)).rejects.toThrow(
      /Only a partner/,
    );
    await client.end();
  });

  it('keeps the counter table out of reach of every api role', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(client.query('select * from organisation_counters')).rejects.toThrow(
      /permission denied/,
    );
    await client.end();
  });
});

describe('the company list', () => {
  it('shows a signed-in person their own company and no other', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query<{ id: string }>('select id from organisations');
    await client.end();
    expect(result.rows.map((row) => row.id)).toEqual([boyds]);
  });

  it('shows an anonymous visitor nothing', async () => {
    const client = await sessionClient(null);
    await expect(client.query('select id from organisations')).rejects.toThrow(
      /permission denied/,
    );
    await client.end();
  });

  it('does not let a partner rename or suspend their company', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(
      client.query(`update organisations set status = 'SUSPENDED' where id = $1`, [
        boyds,
      ]),
    ).rejects.toThrow(/permission denied/);
    await client.end();
  });

  it('gives a suspended person no company at all', async () => {
    const suspended = await seedUser(admin, {
      email: `tenancy-suspended-${unique()}@boyds.test`,
      firstName: 'Suspended',
      role: 'PARTNER',
      status: 'SUSPENDED',
    });
    const client = await sessionClient(suspended.authUserId);
    const result = await client.query<{ org: string | null }>(
      'select current_org_id() as org',
    );
    await client.end();
    expect(result.rows[0]!.org).toBeNull();
  });
});

describe('the public request form is told which company it is for', () => {
  async function submit(slug: string) {
    const client = await sessionClient(null);
    try {
      return await client.query<{ n: string }>(
        `select create_public_job_request(
           $1, 'A Company', 'A Contact', 'a@example.test', null,
           '1 Test Street', 'Charlotte', 'NC', '28202',
           '2 Test Avenue', 'Concord', 'NC', '28025',
           'Test goods', null, null, 'STANDARD', false, 'WEBSITE', null
         ) as n`,
        [slug],
      );
    } finally {
      await client.end();
    }
  }

  it('files the request under that company, with its prefix', async () => {
    const slug = `form-${unique()}`;
    const org = await seedOrganisation(admin, slug, { referencePrefix: 'F' });
    const result = await submit(slug);
    expect(result.rows[0]!.n).toMatch(/^FR-\d{4}-0001$/);

    const stored = await admin.query<{ organisation_id: string }>(
      'select organisation_id from job_requests where request_number = $1 and organisation_id = $2',
      [result.rows[0]!.n, org],
    );
    expect(stored.rowCount).toBe(1);
  });

  it('refuses a company that does not exist', async () => {
    await expect(submit(`nobody-${unique()}`)).rejects.toThrow(/not available/);
  });

  it('refuses a suspended company', async () => {
    const slug = `paused-${unique()}`;
    await seedOrganisation(admin, slug, { status: 'SUSPENDED' });
    await expect(submit(slug)).rejects.toThrow(/not available/);
  });

  it('notifies only that company’s partners', async () => {
    const slug = `notify-${unique()}`;
    await seedOrganisation(admin, slug, { referencePrefix: 'N' });
    const before = await admin.query<{ n: string }>(
      'select count(*) as n from notifications where recipient_user_id = $1',
      [partner.userId],
    );
    await submit(slug);
    const after = await admin.query<{ n: string }>(
      'select count(*) as n from notifications where recipient_user_id = $1',
      [partner.userId],
    );
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });
});
