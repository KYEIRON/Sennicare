import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, seedPartnerRecord, seedUser, sessionClient } from './helpers/db';
import { seedCustomer } from './helpers/operations';

/**
 * Recurring agreements.
 *
 * A contract is how BOYD'S turns one-off jobs into work it can count on. The
 * rules that matter are the ones that stop a half-agreed contract being
 * recorded as a settled one — and the one that keeps an unpriced contract
 * unpriced rather than free.
 */

let admin: Client;
let partner: { authUserId: string; userId: string };
let driver: { authUserId: string; userId: string };
let customerId: string;

beforeAll(async () => {
  admin = await adminClient();

  const partnerUser = await seedUser(admin, {
    email: `contract-partner-${Date.now()}@boyds.test`,
    firstName: 'Test',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, partnerUser.userId, 'Test Partner', 'Test Role');
  partner = partnerUser;

  driver = await seedUser(admin, {
    email: `contract-driver-${Date.now()}@boyds.test`,
    firstName: 'Test',
    role: 'DRIVER',
  });
  await admin.query('insert into drivers (user_id) values ($1)', [driver.userId]);

  customerId = await seedCustomer(admin, 'A Test Company');
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

let counter = 0;
const contractNumber = () => `TEST-K-${(counter += 1)}-${Date.now()}`;

describe('a partner records an agreement', () => {
  it('saves one with no rate settled yet', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query<{ agreed_rate_cents: string | null }>(
      `insert into contracts (contract_number, customer_id, title, status, created_by)
       values ($1, $2, 'A test weekly run', 'DRAFT', $3)
       returning agreed_rate_cents`,
      [contractNumber(), customerId, partner.userId],
    );
    await client.end();

    // Null, not zero. An unpriced agreement is not a free one.
    expect(result.rows[0]!.agreed_rate_cents).toBeNull();
  });

  it('saves one with a rate and a start date', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query<{ status: string; agreed_rate_cents: string }>(
      `insert into contracts (
         contract_number, customer_id, title, status, start_date,
         agreed_rate_cents, rate_basis, created_by
       ) values ($1, $2, 'A test weekly run', 'ACTIVE', current_date, 12500, 'per run', $3)
       returning status, agreed_rate_cents`,
      [contractNumber(), customerId, partner.userId],
    );
    await client.end();

    expect(result.rows[0]!.status).toBe('ACTIVE');
    expect(result.rows[0]!.agreed_rate_cents).toBe('12500');
  });
});

describe('the record refuses an agreement that does not hold together', () => {
  it('will not make a contract live without a start date', async () => {
    await expect(
      admin.query(
        `insert into contracts (contract_number, customer_id, title, status)
         values ($1, $2, 'A test weekly run', 'ACTIVE')`,
        [contractNumber(), customerId],
      ),
    ).rejects.toThrow(/contracts_active_has_start/);
  });

  it('will not end a contract before it starts', async () => {
    await expect(
      admin.query(
        `insert into contracts (contract_number, customer_id, title, start_date, end_date)
         values ($1, $2, 'A test weekly run', current_date, current_date - 1)`,
        [contractNumber(), customerId],
      ),
    ).rejects.toThrow(/contracts_dates_sane/);
  });

  it('will not take a negative rate', async () => {
    await expect(
      admin.query(
        `insert into contracts (contract_number, customer_id, title, agreed_rate_cents)
         values ($1, $2, 'A test weekly run', -1)`,
        [contractNumber(), customerId],
      ),
    ).rejects.toThrow(/contracts_rate_non_negative/);
  });
});

describe('a driver cannot reach contracts', () => {
  it('sees none', async () => {
    await admin.query(
      `insert into contracts (contract_number, customer_id, title)
       values ($1, $2, 'A test weekly run')`,
      [contractNumber(), customerId],
    );

    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from contracts');
    await client.end();

    expect(result.rowCount).toBe(0);
  });

  it('cannot create one', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        `insert into contracts (contract_number, customer_id, title)
         values ($1, $2, 'A test weekly run')`,
        [contractNumber(), customerId],
      ),
    ).rejects.toThrow(/row-level security/);
    await client.end();
  });
});
