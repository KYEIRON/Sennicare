/**
 * Integration test harness — real PostgreSQL, real migrations, real policies.
 *
 * BOYD'S row level security is the authoritative authorisation boundary, so it
 * is tested against an actual database rather than mocked. A mocked policy
 * proves nothing.
 *
 * Sessions are simulated exactly as Supabase does it: SET ROLE authenticated,
 * then set request.jwt.claim.sub to the auth user id. auth.uid() reads that
 * setting, so the policies under test behave identically here and in production.
 */

import { Client } from 'pg';

export const TEST_DB = process.env.BOYDS_TEST_DB ?? 'boyds_test';

export function connectionConfig(database = TEST_DB) {
  return {
    host: process.env.PGHOST ?? '/tmp',
    port: Number(process.env.PGPORT ?? 54322),
    user: process.env.PGUSER ?? 'postgres',
    database,
  };
}

/**
 * A superuser connection, for creating fixtures. Bypasses RLS.
 *
 * If the test database is unreachable, this fails with an actionable message
 * rather than the suite skipping. BOYD'S row level security is the
 * authoritative authorisation boundary; a run that quietly did not test it
 * would report success while proving nothing.
 */
export async function adminClient(): Promise<Client> {
  const client = new Client(connectionConfig());
  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      [
        'Cannot reach the BOYD’S test database, so row level security was NOT tested.',
        '',
        'Start PostgreSQL and rebuild the test database:',
        '  ./supabase/start-test-db.sh',
        '  ./supabase/reset-test-db.sh',
        '',
        `Tried: ${connectionConfig().host}:${connectionConfig().port}/${TEST_DB}`,
      ].join('\n'),
      { cause },
    );
  }
  return client;
}

/**
 * A connection acting as a signed-in BOYD'S user, subject to every policy.
 *
 * Pass null to act as an anonymous visitor — the public website's role.
 */
export async function sessionClient(authUserId: string | null): Promise<Client> {
  const client = new Client(connectionConfig());
  await client.connect();

  if (authUserId === null) {
    await client.query('set role anon');
  } else {
    await client.query('select set_config($1, $2, false)', [
      'request.jwt.claim.sub',
      authUserId,
    ]);
    await client.query('set role authenticated');
  }

  return client;
}

export interface SeededUser {
  authUserId: string;
  userId: string;
  email: string;
}

/**
 * Create a BOYD'S user for a test.
 *
 * These email addresses are obviously synthetic (@boyds.test) and exist only
 * inside the test database. No real BOYD'S person is represented here.
 */
export async function seedUser(
  admin: Client,
  options: {
    email: string;
    firstName: string;
    role: 'PARTNER' | 'DRIVER' | 'ADMIN';
    status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'INACTIVE';
  },
): Promise<SeededUser> {
  const authResult = await admin.query<{ id: string }>(
    'insert into auth.users (email) values ($1) returning id',
    [options.email],
  );
  const authUserId = authResult.rows[0]!.id;

  const userResult = await admin.query<{ id: string }>(
    `insert into users (auth_user_id, email, first_name, role, status)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      authUserId,
      options.email,
      options.firstName,
      options.role,
      options.status ?? 'ACTIVE',
    ],
  );

  return { authUserId, userId: userResult.rows[0]!.id, email: options.email };
}

export async function seedDriverRecord(admin: Client, userId: string): Promise<string> {
  const result = await admin.query<{ id: string }>(
    'insert into drivers (user_id) values ($1) returning id',
    [userId],
  );
  return result.rows[0]!.id;
}

export async function seedPartnerRecord(
  admin: Client,
  userId: string,
  name: string,
  roleTitle: string,
): Promise<string> {
  const result = await admin.query<{ id: string }>(
    'insert into partners (user_id, name, role_title) values ($1, $2, $3) returning id',
    [userId, name, roleTitle],
  );
  return result.rows[0]!.id;
}
