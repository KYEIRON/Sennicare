/**
 * Integration test harness — real PostgreSQL, real migrations, real policies.
 *
 * BOYD'S row level security is the authoritative authorisation boundary, so it
 * is tested against an actual database rather than mocked. A mocked policy
 * proves nothing.
 *
 * Sessions are simulated as Supabase does it: SET ROLE authenticated, with the
 * user in request.jwt.claims. auth.uid() is Supabase's own definition, so the
 * policies under test behave identically here and in production.
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
    // PostgREST passes the signed-in user as JSON claims. Only that form is set
    // here, so SQL that read the legacy `request.jwt.claim.sub` setting
    // directly would fail in the tests exactly as it would in production.
    await client.query('select set_config($1, $2, false)', [
      'request.jwt.claims',
      JSON.stringify({ sub: authUserId, role: 'authenticated' }),
    ]);
    await client.query('set role authenticated');
  }

  return client;
}

/**
 * The id of a company, by its slug. BOYD'S ('boyds') is created by migration
 * 0029 and is the company every fixture belongs to unless a test says
 * otherwise.
 *
 * Fixtures are written over a superuser connection with nobody signed in, so
 * the database cannot infer a company for a top-level record — the test must
 * name one, exactly as production code must.
 */
export async function organisationId(admin: Client, slug = 'boyds'): Promise<string> {
  const result = await admin.query<{ id: string }>(
    'select id from organisations where slug = $1',
    [slug],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`No organisation with slug '${slug}' in the test database.`);
  return id;
}

/**
 * Create a second company for isolation tests. Obviously synthetic.
 */
export async function seedOrganisation(
  admin: Client,
  slug: string,
  options: {
    name?: string;
    referencePrefix?: string;
    status?: 'ACTIVE' | 'SUSPENDED';
  } = {},
): Promise<string> {
  const result = await admin.query<{ id: string }>(
    `insert into organisations (slug, name, reference_prefix, status)
     values ($1, $2, $3, $4) returning id`,
    [
      slug,
      options.name ?? `TEST COMPANY ${slug}`,
      options.referencePrefix ?? 'T',
      options.status ?? 'ACTIVE',
    ],
  );
  return result.rows[0]!.id;
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
    organisationId?: string;
  },
): Promise<SeededUser> {
  const organisation = options.organisationId ?? (await organisationId(admin));

  const authResult = await admin.query<{ id: string }>(
    'insert into auth.users (email) values ($1) returning id',
    [options.email],
  );
  const authUserId = authResult.rows[0]!.id;

  const userResult = await admin.query<{ id: string }>(
    `insert into users (organisation_id, auth_user_id, email, first_name, role, status)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      organisation,
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
