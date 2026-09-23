import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, seedUser, sessionClient, type SeededUser } from './helpers/db';

/**
 * People as data: adding, inviting, activating, re-roling, deactivating and
 * reactivating BOYD'S users, with no code change and no developer.
 *
 * Every write here runs under the acting person's own session, against the
 * real policies and triggers, because the database is what actually decides
 * who may manage people. Email addresses are synthetic (@boyds.test) and exist
 * only in the test database.
 */

let admin: Client; // superuser, for fixtures and inspection only
let theAdmin: SeededUser; // the business's admin — Ronald's role in production
let partner: SeededUser; // a partner who is NOT an admin
let driver: SeededUser;

const stamp = Date.now();

async function authAccount(email: string): Promise<string> {
  const result = await admin.query<{ id: string }>(
    'insert into auth.users (email) values ($1) returning id',
    [email],
  );
  return result.rows[0]!.id;
}

beforeAll(async () => {
  admin = await adminClient();
  theAdmin = await seedUser(admin, {
    email: `um-admin-${stamp}@boyds.test`,
    firstName: 'Admin',
    role: 'ADMIN',
  });
  partner = await seedUser(admin, {
    email: `um-partner-${stamp}@boyds.test`,
    firstName: 'Partner',
    role: 'PARTNER',
  });
  driver = await seedUser(admin, {
    email: `um-driver-${stamp}@boyds.test`,
    firstName: 'Driver',
    role: 'DRIVER',
  });
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

async function asAdmin<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await sessionClient(theAdmin.authUserId);
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe('a colleague whose email is not known yet — the Moh case', () => {
  let personId: string;

  it('can be recorded with a partner record and a driver record, and no email', async () => {
    personId = await asAdmin(async (client) => {
      const person = await client.query<{ id: string; status: string }>(
        `insert into users (first_name, role) values ('Pending', 'DRIVER')
         returning id, status`,
      );
      const id = person.rows[0]!.id;
      await client.query(
        `insert into partners (user_id, name, role_title) values ($1, 'Pending', 'Test Partner Role')`,
        [id],
      );
      await client.query('insert into drivers (user_id) values ($1)', [id]);
      expect(person.rows[0]!.status).toBe('INVITED');
      return id;
    });

    const row = await admin.query<{ email: string | null; auth_user_id: string | null }>(
      'select email, auth_user_id from users where id = $1',
      [personId],
    );
    expect(row.rows[0]).toEqual({ email: null, auth_user_id: null });
  });

  it('cannot be made ACTIVE while there is nothing to sign in with', async () => {
    await expect(
      asAdmin((client) =>
        client.query("update users set status = 'ACTIVE' where id = $1", [personId]),
      ),
    ).rejects.toThrow(/users_active_needs_signin/);
  });

  it('cannot be linked to a sign-in account without an email', async () => {
    const authId = await authAccount(`um-nolink-${stamp}@boyds.test`);
    await expect(
      asAdmin((client) =>
        client.query('update users set auth_user_id = $2 where id = $1', [
          personId,
          authId,
        ]),
      ),
    ).rejects.toThrow(/users_signin_needs_email/);
  });

  it('is invited later by adding the real email — no schema or code change', async () => {
    const email = `um-pending-${stamp}@boyds.test`;
    const authId = await authAccount(email);

    await asAdmin((client) =>
      client.query('update users set email = $2, auth_user_id = $3 where id = $1', [
        personId,
        email,
        authId,
      ]),
    );

    // They sign in for the first time.
    const client = await sessionClient(authId);
    const signIn = await client.query<{ role: string; status: string }>(
      'select * from record_my_sign_in()',
    );
    expect(signIn.rows[0]).toEqual({ role: 'DRIVER', status: 'ACTIVE' });

    // The same driver record, created before they had an email, is theirs.
    const isDriver = await client.query<{ is_driver: boolean }>('select is_driver()');
    const ownDriver = await client.query('select id from drivers where user_id = $1', [
      personId,
    ]);
    await client.end();

    expect(isDriver.rows[0]!.is_driver).toBe(true);
    expect(ownDriver.rowCount).toBe(1);

    const partnerRecord = await admin.query('select 1 from partners where user_id = $1', [
      personId,
    ]);
    expect(partnerRecord.rowCount).toBe(1);
  });
});

describe('inviting a new person with an email', () => {
  it('records them as invited, and first sign-in activates them', async () => {
    const email = `um-new-${stamp}@boyds.test`;

    const personId = await asAdmin(async (client) => {
      const row = await client.query<{ id: string }>(
        `insert into users (email, first_name, role) values ($1, 'New', 'PARTNER') returning id`,
        [email],
      );
      return row.rows[0]!.id;
    });

    // The invitation creates their sign-in account; the server links it.
    const authId = await authAccount(email);
    await asAdmin((client) =>
      client.query('update users set auth_user_id = $2 where id = $1', [
        personId,
        authId,
      ]),
    );

    const client = await sessionClient(authId);
    const before = await client.query<{ is_partner: boolean }>('select is_partner()');
    await client.query('select * from record_my_sign_in()');
    const after = await client.query<{ is_partner: boolean }>('select is_partner()');
    await client.end();

    // No access until they have actually signed in and been activated.
    expect(before.rows[0]!.is_partner).toBe(false);
    expect(after.rows[0]!.is_partner).toBe(true);
  });

  it('can be any role — not everyone is a driver', async () => {
    for (const role of ['PARTNER', 'DRIVER', 'ADMIN'] as const) {
      const result = await asAdmin((client) =>
        client.query<{ role: string }>(
          `insert into users (email, first_name, role) values ($1, 'Any', $2) returning role`,
          [`um-role-${role.toLowerCase()}-${stamp}@boyds.test`, role],
        ),
      );
      expect(result.rows[0]!.role).toBe(role);
    }
  });
});

describe('only an admin manages people', () => {
  it('refuses a partner who is not an admin adding a person', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(
      client.query(
        `insert into users (email, first_name, role) values ($1, 'X', 'PARTNER')`,
        [`um-byp-${stamp}@boyds.test`],
      ),
    ).rejects.toThrow(/row-level security/);
    await client.end();
  });

  it('refuses a partner promoting themselves to admin', async () => {
    // Before migration 0027, this succeeded.
    const client = await sessionClient(partner.authUserId);
    const result = await client.query("update users set role = 'ADMIN' where id = $1", [
      partner.userId,
    ]);
    await client.end();

    expect(result.rowCount).toBe(0);
    const row = await admin.query<{ role: string }>(
      'select role from users where id = $1',
      [partner.userId],
    );
    expect(row.rows[0]!.role).toBe('PARTNER');
  });

  it('refuses a partner changing anyone else’s role or status', async () => {
    const client = await sessionClient(partner.authUserId);
    const result = await client.query(
      "update users set status = 'INACTIVE' where id = $1",
      [driver.userId],
    );
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('refuses a partner creating a partner record', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(
      client.query(
        `insert into partners (user_id, name, role_title) values ($1, 'X', 'Y')`,
        [driver.userId],
      ),
    ).rejects.toThrow(/row-level security/);
    await client.end();
  });

  it('refuses a driver doing any of it', async () => {
    const client = await sessionClient(driver.authUserId);
    const result = await client.query("update users set role = 'ADMIN' where id = $1", [
      driver.userId,
    ]);
    await client.end();
    expect(result.rowCount).toBe(0);
  });
});

describe('guardrails no screen can bypass', () => {
  it('stops an admin changing their own role or status', async () => {
    await expect(
      asAdmin((client) =>
        client.query("update users set role = 'PARTNER' where id = $1", [
          theAdmin.userId,
        ]),
      ),
    ).rejects.toThrow(/own role or status/);
  });

  it('never lets the business lose its last active admin', async () => {
    const admins = await admin.query<{ n: string }>(
      "select count(*) as n from users where role = 'ADMIN' and status = 'ACTIVE'",
    );
    // Guard the premise: only this file's admin is active.
    expect(admins.rows[0]!.n).toBe('1');

    // Even the superuser — so no path at all — can remove the last admin.
    await expect(
      admin.query("update users set status = 'INACTIVE' where id = $1", [
        theAdmin.userId,
      ]),
    ).rejects.toThrow(/last active admin/);
  });

  it('never lets a linked sign-in account be re-pointed at another', async () => {
    const other = await authAccount(`um-steal-${stamp}@boyds.test`);
    await expect(
      asAdmin((client) =>
        client.query('update users set auth_user_id = $2 where id = $1', [
          driver.userId,
          other,
        ]),
      ),
    ).rejects.toThrow(/cannot be changed or removed/);
  });

  it('does not let a signed-in person’s email drift from their sign-in', async () => {
    await expect(
      asAdmin((client) =>
        client.query('update users set email = $2 where id = $1', [
          driver.userId,
          `um-changed-${stamp}@boyds.test`,
        ]),
      ),
    ).rejects.toThrow(/cannot be changed here/);
  });
});

describe('deactivating and reactivating', () => {
  it('takes effect at the database immediately, even mid-session', async () => {
    const session = await sessionClient(partner.authUserId);
    const before = await session.query<{ is_partner: boolean }>('select is_partner()');

    await asAdmin((client) =>
      client.query("update users set status = 'INACTIVE' where id = $1", [
        partner.userId,
      ]),
    );
    const during = await session.query<{ is_partner: boolean }>('select is_partner()');
    const customers = await session.query('select id from customers');

    await asAdmin((client) =>
      client.query("update users set status = 'ACTIVE' where id = $1", [partner.userId]),
    );
    const after = await session.query<{ is_partner: boolean }>('select is_partner()');
    await session.end();

    expect(before.rows[0]!.is_partner).toBe(true);
    expect(during.rows[0]!.is_partner).toBe(false);
    expect(customers.rowCount).toBe(0);
    expect(after.rows[0]!.is_partner).toBe(true);
  });

  it('cannot be undone by the deactivated person signing in again', async () => {
    await asAdmin((client) =>
      client.query("update users set status = 'SUSPENDED' where id = $1", [
        driver.userId,
      ]),
    );

    const client = await sessionClient(driver.authUserId);
    const result = await client.query<{ status: string }>(
      'select * from record_my_sign_in()',
    );
    await client.end();
    expect(result.rows[0]!.status).toBe('SUSPENDED');

    await asAdmin((c) =>
      c.query("update users set status = 'ACTIVE' where id = $1", [driver.userId]),
    );
  });

  it('with a second admin, either can deactivate the other', async () => {
    const second = await seedUser(admin, {
      email: `um-admin2-${stamp}@boyds.test`,
      firstName: 'Second',
      role: 'ADMIN',
    });

    const client = await sessionClient(second.authUserId);
    await client.query("update users set status = 'INACTIVE' where id = $1", [
      theAdmin.userId,
    ]);
    await client.query("update users set status = 'ACTIVE' where id = $1", [
      theAdmin.userId,
    ]);
    await client.end();

    // Leave the premise as it was: one active admin.
    await asAdmin((c) =>
      c.query("update users set status = 'INACTIVE' where id = $1", [second.userId]),
    );
  });
});

describe('the audit trail', () => {
  it('records who changed a person’s role, from what, to what', async () => {
    const person = await asAdmin(async (client) => {
      const row = await client.query<{ id: string }>(
        `insert into users (email, first_name, role) values ($1, 'Audit', 'DRIVER') returning id`,
        [`um-audit-${stamp}@boyds.test`],
      );
      await client.query("update users set role = 'PARTNER' where id = $1", [
        row.rows[0]!.id,
      ]);
      return row.rows[0]!.id;
    });

    const log = await admin.query<{
      user_id: string;
      old_value: string;
      new_value: string;
    }>(
      `select user_id, old_value, new_value from audit_logs
        where entity_table = 'users' and entity_id = $1 and field = 'role'`,
      [person],
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]).toEqual({
      user_id: theAdmin.userId,
      old_value: 'DRIVER',
      new_value: 'PARTNER',
    });
  });

  it('records a deactivation', async () => {
    const person = await asAdmin(async (client) => {
      const row = await client.query<{ id: string }>(
        `insert into users (email, first_name, role) values ($1, 'Leaver', 'DRIVER') returning id`,
        [`um-leaver-${stamp}@boyds.test`],
      );
      await client.query("update users set status = 'INACTIVE' where id = $1", [
        row.rows[0]!.id,
      ]);
      return row.rows[0]!.id;
    });

    const log = await admin.query<{ action: string; new_value: string }>(
      `select action, new_value from audit_logs
        where entity_table = 'users' and entity_id = $1 and field = 'status'`,
      [person],
    );
    expect(log.rows).toEqual([{ action: 'STATUS_CHANGED', new_value: 'INACTIVE' }]);
  });
});

describe('add_team_member — the Team screen’s one write', () => {
  it('adds a person, their partner record and their driver record together', async () => {
    const id = await asAdmin(async (client) => {
      const r = await client.query<{ add_team_member: string }>(
        `select add_team_member('Whole', 'Person', null, 'DRIVER', 'Test Partner Role', true)`,
      );
      return r.rows[0]!.add_team_member;
    });

    const records = await admin.query<{
      partner: string;
      driver: string;
      email: string | null;
    }>(
      `select (select count(*) from partners where user_id = $1)::text as partner,
              (select count(*) from drivers where user_id = $1)::text as driver,
              (select email from users where id = $1) as email`,
      [id],
    );
    expect(records.rows[0]).toEqual({ partner: '1', driver: '1', email: null });
  });

  it('adds nothing at all when any part fails', async () => {
    const email = `um-atomic-${stamp}@boyds.test`;
    await asAdmin((client) =>
      client.query(
        `insert into users (email, first_name, role) values ($1, 'First', 'DRIVER')`,
        [email],
      ),
    );

    // Same email again: the users insert fails, so nothing else may remain.
    await expect(
      asAdmin((client) =>
        client.query(
          `select add_team_member('Second', null, $1, 'DRIVER', 'Title', true)`,
          [email],
        ),
      ),
    ).rejects.toThrow(/duplicate key/);

    const leftovers = await admin.query(
      "select 1 from partners where name = 'Second' and role_title = 'Title'",
    );
    expect(leftovers.rowCount).toBe(0);
  });

  it('gives a partner who is not an admin no way round the rules', async () => {
    const client = await sessionClient(partner.authUserId);
    await expect(
      client.query(`select add_team_member('Sneaky', null, null, 'ADMIN', null, false)`),
    ).rejects.toThrow(/row-level security/);
    await client.end();
  });

  it('is not callable by the public at all', async () => {
    const client = await sessionClient(null);
    await expect(
      client.query(`select add_team_member('Anon', null, null, 'ADMIN', null, false)`),
    ).rejects.toThrow(/permission denied/);
    await client.end();
  });
});
