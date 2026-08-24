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

/**
 * BOYD'S row level security, tested against real PostgreSQL with the real
 * migrations applied.
 *
 * These are the tests that matter most for security. Business rules 27-31 say a
 * driver must never reach company financial information or other people's
 * records. Proving that in the application layer alone would prove very little:
 * the guarantee has to hold at the database, because that is the layer that
 * survives an application bug.
 */

let admin: Client;
let partner: SeededUser;
let driver: SeededUser;
let otherDriver: SeededUser;
let suspendedPartner: SeededUser;

beforeAll(async () => {
  admin = await adminClient();

  partner = await seedUser(admin, {
    email: 'partner@boyds.test',
    firstName: 'TestPartner',
    role: 'PARTNER',
  });
  driver = await seedUser(admin, {
    email: 'driver@boyds.test',
    firstName: 'TestDriver',
    role: 'DRIVER',
  });
  otherDriver = await seedUser(admin, {
    email: 'other-driver@boyds.test',
    firstName: 'OtherDriver',
    role: 'DRIVER',
  });
  suspendedPartner = await seedUser(admin, {
    email: 'suspended@boyds.test',
    firstName: 'SuspendedPartner',
    role: 'PARTNER',
    status: 'SUSPENDED',
  });

  await seedPartnerRecord(admin, partner.userId, 'TestPartner', 'Test Partner');
  await seedDriverRecord(admin, driver.userId);
  await seedDriverRecord(admin, otherDriver.userId);
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('users table', () => {
  it('lets a partner see every user', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from users');
    await client.end();
    expect(result.rowCount).toBeGreaterThanOrEqual(4);
  });

  it('lets a driver see ONLY their own record', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query<{ email: string }>('select email from users');
    await client.end();

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]!.email).toBe('driver@boyds.test');
  });

  it('does not let a driver enumerate other people in the business', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from users where email = $1', [
      'partner@boyds.test',
    ]);
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('shows an anonymous visitor nothing at all', async () => {
    const client = await sessionClient(null);
    await expect(client.query('select id from users')).rejects.toThrow(
      /permission denied/i,
    );
    await client.end();
  });

  it('strips a SUSPENDED partner of every partner privilege', async () => {
    const client = await sessionClient(suspendedPartner.authUserId);

    const users = await client.query<{ email: string }>('select email from users');
    const partners = await client.query('select id from partners');
    const drivers = await client.query('select id from drivers');
    const isPartner = await client.query<{ is_partner: boolean }>(
      'select is_partner() as is_partner',
    );
    await client.end();

    // current_app_user_id() resolves only ACTIVE users, so a suspended session
    // is not a partner and every partner policy fails closed.
    expect(isPartner.rows[0]!.is_partner).toBe(false);
    expect(partners.rowCount).toBe(0);
    expect(drivers.rowCount).toBe(0);

    // They can still read THEIR OWN user row, and only that row. This is
    // deliberate: it is how the application knows to say "this account is not
    // active" rather than the misleading "those details were not recognised".
    expect(users.rowCount).toBe(1);
    expect(users.rows[0]!.email).toBe('suspended@boyds.test');
  });

  it('does not let a SUSPENDED partner write anything', async () => {
    const client = await sessionClient(suspendedPartner.authUserId);

    const selfUpdate = await client.query(
      "update users set first_name = 'Renamed' where auth_user_id = $1",
      [suspendedPartner.authUserId],
    );
    await expect(
      client.query(
        'insert into partners (user_id, name, role_title) values ($1, $2, $3)',
        [suspendedPartner.userId, 'Suspended', 'Reinstated'],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();

    // No self-update policy exists, so reading your own row does not imply
    // being able to change it.
    expect(selfUpdate.rowCount).toBe(0);
  });
});

describe('privilege escalation', () => {
  it('does not let a driver promote themselves to PARTNER', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query(
      "update users set role = 'PARTNER' where auth_user_id = $1",
      [driver.authUserId],
    );
    await client.end();

    // No update policy matches a driver, so the statement affects zero rows.
    expect(result.rowCount).toBe(0);

    const check = await admin.query<{ role: string }>(
      'select role from users where id = $1',
      [driver.userId],
    );
    expect(check.rows[0]!.role).toBe('DRIVER');
  });

  it('does not let a driver create a new PARTNER account', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        `insert into users (email, first_name, role, status)
         values ('escalation@boyds.test', 'Escalation', 'PARTNER', 'ACTIVE')`,
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });

  it('does not let a driver change another driver’s record', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query(
      'update drivers set phone = $1 where user_id = $2',
      ['0000000000', otherDriver.userId],
    );
    await client.end();
    expect(result.rowCount).toBe(0);
  });
});

describe('partners table — not visible to the driver surface', () => {
  it('lets a partner read partner records', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query('select id from partners');
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('shows a driver zero partner records', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from partners');
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('does not let a driver insert a partner record for themselves', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        'insert into partners (user_id, name, role_title) values ($1, $2, $3)',
        [driver.userId, 'TestDriver', 'Self-appointed'],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });
});

describe('drivers table — row and column boundaries', () => {
  it('lets a driver see their own driver record', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from drivers');
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('does not show a driver another driver’s record', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query('select id from drivers where user_id = $1', [
      otherDriver.userId,
    ]);
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('lets a driver update their own phone number', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query(
      'update drivers set phone = $1 where user_id = $2',
      ['555-TEST', driver.userId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('does NOT let a driver change their own licence details', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query('update drivers set license_number = $1 where user_id = $2', [
        'SELF-ISSUED',
        driver.userId,
      ]),
    ).rejects.toThrow(/only update their own phone number/i);
    await client.end();
  });

  it('does NOT let a driver reactivate themselves', async () => {
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query('update drivers set active = false where user_id = $1', [
        driver.userId,
      ]),
    ).rejects.toThrow(/only update their own phone number/i);
    await client.end();
  });

  it('DOES let a partner maintain licence details', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query(
      'update drivers set license_state = $1 where user_id = $2',
      ['NC', driver.userId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });
});

describe('helper functions default to no access', () => {
  it('reports is_partner() false with no session', async () => {
    const result = await admin.query<{ is_partner: boolean }>(
      'select is_partner() as is_partner',
    );
    expect(result.rows[0]!.is_partner).toBe(false);
  });

  it('reports is_driver() false with no session', async () => {
    const result = await admin.query<{ is_driver: boolean }>(
      'select is_driver() as is_driver',
    );
    expect(result.rows[0]!.is_driver).toBe(false);
  });
});

describe('every table has row level security enabled', () => {
  it('leaves no table unprotected', async () => {
    const result = await admin.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and rowsecurity = false`,
    );
    expect(result.rows.map((r) => r.tablename)).toEqual([]);
  });
});
