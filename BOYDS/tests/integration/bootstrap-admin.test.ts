import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { connectionConfig } from './helpers/db';

/**
 * scripts/bootstrap-first-admin.sql — the one person not added from the Team
 * screen, because nobody exists yet to add them.
 *
 * Run against its own freshly migrated database, exactly as it will be run on
 * a freshly deployed production project: as the migrating role, which is what
 * Supabase's SQL editor runs as.
 */

const DB = 'boyds_bootstrap';
const ROOT = join(__dirname, '..', '..');
const SCRIPT = readFileSync(join(ROOT, 'scripts', 'bootstrap-first-admin.sql'), 'utf8');

let superuser: Client;
let editor: Client; // the SQL editor's role

function filledIn(email: string, partnerTitle: string | null): string {
  return SCRIPT.replace("'REPLACE-WITH-EMAIL'", `'${email}'`)
    .replace("'REPLACE-WITH-FIRST-NAME'", "'First'")
    .replace(
      'v_partner_title text := null;',
      `v_partner_title text := ${partnerTitle ? `'${partnerTitle}'` : 'null'};`,
    );
}

beforeAll(async () => {
  execSync('./supabase/reset-test-db.sh', {
    cwd: ROOT,
    env: { ...process.env, BOYDS_TEST_DB: DB },
    stdio: 'ignore',
  });
  superuser = new Client(connectionConfig(DB));
  await superuser.connect();
  editor = new Client({ ...connectionConfig(DB), user: 'supabase_postgres' });
  await editor.connect();
}, 120_000);

afterAll(async () => {
  await editor?.end();
  await superuser?.end();
  const admin = new Client(connectionConfig('postgres'));
  await admin.connect();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.end();
});

describe('the first-admin bootstrap', () => {
  it('refuses to run until its values are edited', async () => {
    await expect(editor.query(SCRIPT)).rejects.toThrow(/Edit the values/);
  });

  it('refuses when the sign-in account does not exist yet', async () => {
    await expect(editor.query(filledIn('first@boyds.test', null))).rejects.toThrow(
      /No sign-in account exists/,
    );
    const users = await superuser.query('select 1 from users');
    expect(users.rowCount).toBe(0);
  });

  it('creates an active admin, linked, with a partner record', async () => {
    const auth = await superuser.query<{ id: string }>(
      "insert into auth.users (email) values ('first@boyds.test') returning id",
    );
    await editor.query(filledIn('first@boyds.test', 'Test Partner Role'));

    const row = await superuser.query<{
      role: string;
      status: string;
      auth_user_id: string;
      partner: string;
    }>(
      `select role, status, auth_user_id,
              (select role_title from partners p where p.user_id = u.id) as partner
         from users u where email = 'first@boyds.test'`,
    );
    expect(row.rows[0]).toEqual({
      role: 'ADMIN',
      status: 'ACTIVE',
      auth_user_id: auth.rows[0]!.id,
      partner: 'Test Partner Role',
    });

    // And as that person, signed in: an admin, and a partner — so the
    // Command Centre and the Team screen are both theirs.
    const session = new Client(connectionConfig(DB));
    await session.connect();
    await session.query('select set_config($1, $2, false)', [
      'request.jwt.claims',
      JSON.stringify({ sub: auth.rows[0]!.id, role: 'authenticated' }),
    ]);
    await session.query('set role authenticated');
    const access = await session.query<{ is_admin: boolean; is_partner: boolean }>(
      'select is_admin(), is_partner()',
    );
    await session.end();
    expect(access.rows[0]).toEqual({ is_admin: true, is_partner: true });
  });

  it('refuses a second run — further people come from the Team screen', async () => {
    await superuser.query("insert into auth.users (email) values ('second@boyds.test')");
    await expect(editor.query(filledIn('second@boyds.test', null))).rejects.toThrow(
      /active admin already exists/,
    );
    const admins = await superuser.query("select 1 from users where role = 'ADMIN'");
    expect(admins.rowCount).toBe(1);
  });
});
