import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { adminClient, connectionConfig } from './helpers/db';

/**
 * The production deployment scripts, run against the test database.
 *
 * scripts/preflight-production.sql and scripts/verify-production.sql are what
 * stand between a migration and the live project. They copy their expectations
 * from the tests in this directory; running them here means that if a test's
 * expectation changes and the script's does not, the build says so — rather
 * than production verification failing, or worse, passing, on launch day.
 *
 * They run as the migrating role, exactly as they would in production.
 */

interface CheckRow {
  ord: number;
  check: string;
  result: 'PASS' | 'INFO' | 'STOP';
  detail: string;
}

const SCRIPTS = join(__dirname, '..', '..', 'scripts');

/** The newest migration in the repository, e.g. "0027". */
const LATEST_MIGRATION = readdirSync(
  join(__dirname, '..', '..', 'supabase', 'migrations'),
)
  .filter((file) => /^\d+_.*\.sql$/.test(file))
  .map((file) => file.split('_')[0]!)
  .sort()
  .at(-1)!;
const MIGRATION_COUNT = readdirSync(
  join(__dirname, '..', '..', 'supabase', 'migrations'),
).filter((file) => /^\d+_.*\.sql$/.test(file)).length;

let admin: Client;
let migrator: Client;

beforeAll(async () => {
  admin = await adminClient();
  migrator = new Client({ ...connectionConfig(), user: 'supabase_postgres' });
  await migrator.connect();
}, 30_000);

afterAll(async () => {
  await migrator?.end();
  await admin?.end();
});

async function run(script: string): Promise<CheckRow[]> {
  const sql = readFileSync(join(SCRIPTS, script), 'utf8');
  const result = await migrator.query<CheckRow>(sql);
  return result.rows;
}

describe('verify-production.sql', () => {
  it('requires every migration in the repository, not an older set', () => {
    // Otherwise production verification could pass on a project missing the
    // newest — often security — migration.
    const sql = readFileSync(join(SCRIPTS, 'verify-production.sql'), 'utf8');
    expect(sql).toContain(`>= ${MIGRATION_COUNT}`);
    expect(sql).toContain(`>= '${LATEST_MIGRATION}'`);
  });

  it('passes every check on a correctly migrated database', async () => {
    const rows = await run('verify-production.sql');
    const stops = rows.filter((row) => row.result === 'STOP');

    expect(stops).toEqual([]);
    expect(rows.filter((row) => row.result === 'PASS')).toHaveLength(10);
  });

  it('changes nothing', async () => {
    const before = await admin.query<{ n: string }>(
      'select count(*) as n from audit_logs',
    );
    await run('verify-production.sql');
    const after = await admin.query<{ n: string }>(
      'select count(*) as n from audit_logs',
    );

    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  it('stops on a view the public can write through', async () => {
    await admin.query('grant insert on driver_vehicle_maintenance to anon');
    try {
      const rows = await run('verify-production.sql');
      const stopped = rows.filter((row) => row.result === 'STOP').map((row) => row.check);
      expect(stopped).toContain('public role reaches only the website reference tables');
      expect(stopped).toContain('no api role can write through a view');
    } finally {
      await admin.query('revoke insert on driver_vehicle_maintenance from anon');
    }
  });

  it('stops on a public document bucket', async () => {
    await admin.query(
      "update storage.buckets set public = true where id = 'boyds-documents'",
    );
    try {
      const rows = await run('verify-production.sql');
      expect(rows.find((row) => row.ord === 8)!.result).toBe('STOP');
    } finally {
      await admin.query(
        "update storage.buckets set public = false where id = 'boyds-documents'",
      );
    }
  });

  it('stops on illustrative data', async () => {
    const inserted = await admin.query<{ id: string }>(
      `insert into customers (customer_number, company_name, provenance)
       values ($1, 'Illustrative Co', 'DEMO') returning id`,
      [`TEST-DEMO-${Date.now()}`],
    );
    try {
      const rows = await run('verify-production.sql');
      const row = rows.find((r) => r.ord === 10)!;
      expect(row.result).toBe('STOP');
      expect(row.detail).toContain('customers=');
    } finally {
      await admin.query('delete from customers where id = $1', [inserted.rows[0]!.id]);
    }
  });
});

describe('preflight-production.sql', () => {
  it('recognises an already-migrated project and raises no STOP', async () => {
    const rows = await run('preflight-production.sql');

    expect(rows.filter((row) => row.result === 'STOP')).toEqual([]);
    expect(rows.find((row) => row.check === 'database state')!.detail).toContain(
      `already migrated through ${LATEST_MIGRATION}`,
    );
  });

  it('confirms the migrating role bypasses row level security', async () => {
    const rows = await run('preflight-production.sql');
    expect(rows.find((row) => row.ord === 3)!.result).toBe('PASS');
  });
});
