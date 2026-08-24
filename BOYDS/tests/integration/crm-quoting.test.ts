import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { jobTypeId, seedCustomer } from './helpers/operations';

/**
 * CRM and quoting at the database.
 *
 * Commercial data is partner-only. A quote records why it was priced as it was,
 * and an expired quote cannot be accepted without being re-issued.
 */

let admin: Client;
let partner: SeededUser;
let driver: SeededUser;
let customerId: string;
let typeId: string;

beforeAll(async () => {
  admin = await adminClient();

  partner = await seedUser(admin, {
    email: 'crm-partner@boyds.test',
    firstName: 'CrmPartner',
    role: 'PARTNER',
  });
  await admin.query(
    'insert into partners (user_id, name, role_title) values ($1, $2, $3)',
    [partner.userId, 'CrmPartner', 'Test Partner'],
  );

  driver = await seedUser(admin, {
    email: 'crm-driver@boyds.test',
    firstName: 'CrmDriver',
    role: 'DRIVER',
  });
  await seedDriverRecord(admin, driver.userId);

  customerId = await seedCustomer(admin, 'CRM FIXTURE');
  typeId = await jobTypeId(admin);
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

async function seedQuote(overrides: { validUntil?: string | null; price?: number } = {}) {
  const result = await admin.query<{ id: string }>(
    `insert into quotes (quote_number, customer_id, job_type_id, quoted_price_cents, valid_until, status)
     values ($1, $2, $3, $4, $5, 'SENT') returning id`,
    [
      `BQ-TEST-${Math.random().toString(36).slice(2, 8)}`,
      customerId,
      typeId,
      overrides.price ?? 30_000,
      overrides.validUntil === undefined ? '2099-12-31' : overrides.validUntil,
    ],
  );
  return result.rows[0]!.id;
}

describe('commercial data is partner-only', () => {
  it.each(['leads', 'quotes', 'pricing_rules', 'quote_items'])(
    'shows a driver zero rows in %s',
    async (table) => {
      await admin.query(
        `insert into leads (lead_number, company_name) values ($1, 'FIXTURE CO')
         on conflict do nothing`,
        [`BL-${Math.random().toString(36).slice(2, 8)}`],
      );
      await seedQuote();

      const client = await sessionClient(driver.authUserId);
      const result = await client.query(`select 1 from ${table}`);
      await client.end();

      expect(result.rowCount).toBe(0);
    },
  );

  it('does not let a driver create a quote', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        `insert into quotes (quote_number, customer_id, job_type_id, quoted_price_cents)
         values ('BQ-INTRUDER', $1, $2, 1)`,
        [customerId, typeId],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });

  it('lets a partner manage quotes', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from quotes');
    await client.end();
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });
});

describe('a lost lead records why', () => {
  it('refuses LOST with no reason', async () => {
    await expect(
      admin.query(
        `insert into leads (lead_number, company_name, stage)
         values ($1, 'LOST CO', 'LOST')`,
        [`BL-${Math.random().toString(36).slice(2, 8)}`],
      ),
    ).rejects.toThrow(/lost_has_reason/i);
  });

  it('accepts LOST with a reason', async () => {
    await expect(
      admin.query(
        `insert into leads (lead_number, company_name, stage, lost_reason)
         values ($1, 'LOST CO', 'LOST', 'Went with an existing supplier')`,
        [`BL-${Math.random().toString(36).slice(2, 8)}`],
      ),
    ).resolves.toBeTruthy();
  });
});

describe('quote expiry', () => {
  it('refuses to accept an expired quote', async () => {
    const quoteId = await seedQuote({ validUntil: '2020-01-01' });
    await expect(
      admin.query("update quotes set status = 'ACCEPTED' where id = $1", [quoteId]),
    ).rejects.toThrow(/expired/i);
  });

  it('accepts a quote that is still valid', async () => {
    const quoteId = await seedQuote({ validUntil: '2099-12-31' });
    await expect(
      admin.query("update quotes set status = 'ACCEPTED' where id = $1", [quoteId]),
    ).resolves.toBeTruthy();
  });

  it('accepts a quote with no expiry set', async () => {
    const quoteId = await seedQuote({ validUntil: null });
    await expect(
      admin.query("update quotes set status = 'ACCEPTED' where id = $1", [quoteId]),
    ).resolves.toBeTruthy();
  });

  it('stamps the response time on acceptance', async () => {
    const quoteId = await seedQuote();
    await admin.query("update quotes set status = 'ACCEPTED' where id = $1", [quoteId]);

    const result = await admin.query<{ responded_at: Date | null }>(
      'select responded_at from quotes where id = $1',
      [quoteId],
    );
    expect(result.rows[0]!.responded_at).not.toBeNull();
  });
});

describe('pricing below the floor is deliberate and recorded', () => {
  it('refuses an override with no reason', async () => {
    await expect(
      admin.query(
        `insert into quotes (quote_number, customer_id, job_type_id, quoted_price_cents,
          below_minimum_override)
         values ($1, $2, $3, 1000, true)`,
        [`BQ-${Math.random().toString(36).slice(2, 8)}`, customerId, typeId],
      ),
    ).rejects.toThrow(/override_has_reason/i);
  });

  it('accepts an override with a reason', async () => {
    await expect(
      admin.query(
        `insert into quotes (quote_number, customer_id, job_type_id, quoted_price_cents,
          below_minimum_override, override_reason)
         values ($1, $2, $3, 1000, true, 'Strategic first job with this customer')`,
        [`BQ-${Math.random().toString(36).slice(2, 8)}`, customerId, typeId],
      ),
    ).resolves.toBeTruthy();
  });

  it('audits a price change on a quote', async () => {
    const quoteId = await seedQuote();
    await admin.query('update quotes set quoted_price_cents = 35000 where id = $1', [
      quoteId,
    ]);

    const audit = await admin.query<{
      action: string;
      old_value: string;
      new_value: string;
    }>(
      "select action, old_value, new_value from audit_logs where entity_id = $1 and action = 'PRICE_CHANGED'",
      [quoteId],
    );

    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0]!.new_value).toBe('35000');
  });
});

describe('pricing rules', () => {
  it('refuses an impossible target margin', async () => {
    await expect(
      admin.query(
        `insert into pricing_rules (name, target_margin_bps) values ('Impossible', 10000)`,
      ),
    ).rejects.toThrow(/bps_sane/i);
  });

  it('accepts a sane rule', async () => {
    await expect(
      admin.query(
        `insert into pricing_rules (name, target_margin_bps, minimum_contribution_cents)
         values ('Standard', 2000, 5000)`,
      ),
    ).resolves.toBeTruthy();
  });

  it('allows every threshold to be NULL — BOYD’S current state', async () => {
    const result = await admin.query<{ target_margin_bps: number | null }>(
      `insert into pricing_rules (name) values ('Nothing configured')
       returning target_margin_bps`,
    );
    expect(result.rows[0]!.target_margin_bps).toBeNull();
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
