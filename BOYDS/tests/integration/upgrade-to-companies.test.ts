import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { connectionConfig } from './helpers/db';

/**
 * The upgrade production will actually take: a database at migration 0028,
 * already holding BOYD'S records, brought forward to companies (0029 onwards).
 *
 * Every other integration test starts from an empty database, which proves the
 * migrations are correct but not that they are SAFE on live data. This one
 * fills a 0028 database with records shaped like BOYD'S — reference numbers
 * in the old format, an incident numbered by the old sequence — and checks that
 * after the upgrade nothing is lost, everything belongs to BOYD'S, and the next
 * numbers carry on rather than start again and collide.
 *
 * Every value is synthetic (@boyds.test, TEST names). No real BOYD'S record is
 * represented.
 */

const DB = 'boyds_upgrade';
const RESTORED = 'boyds_upgrade_restored';
const BACKUP_DIR = mkdtempSync(join(tmpdir(), 'boyds-upgrade-'));
const ROOT = join(__dirname, '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const FILES = readdirSync(MIGRATIONS)
  .filter((file) => /^\d+_.*\.sql$/.test(file))
  .sort();
const BEFORE = FILES.filter((file) => file < '0029');
const AFTER = FILES.filter((file) => file >= '0029');
const YEAR = 2026;

let superuser: Client;

function databaseUrl(database: string): string {
  const config = connectionConfig(database);
  return `postgresql://${config.user}@/${database}?host=${encodeURIComponent(config.host)}&port=${config.port}`;
}

function psql(args: string[], user = 'supabase_postgres') {
  const config = connectionConfig(DB);
  execFileSync(
    'psql',
    [
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      '-h',
      config.host,
      '-p',
      String(config.port),
      '-U',
      user,
      '-d',
      DB,
      ...args,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}

function apply(files: readonly string[]) {
  for (const file of files) {
    psql(['-f', join(MIGRATIONS, file)]);
    const [version, ...name] = file.replace(/\.sql$/, '').split('_');
    psql([
      '-c',
      `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name.join('_')}')`,
    ]);
  }
}

const counts: Record<string, number> = {};
const TABLES = [
  'users',
  'drivers',
  'partners',
  'customers',
  'vehicles',
  'jobs',
  'leads',
  'quotes',
  'invoices',
  'contracts',
  'job_requests',
  'incidents',
  'notifications',
  'audit_logs',
];

beforeAll(async () => {
  const postgres = new Client(connectionConfig('postgres'));
  await postgres.connect();
  await postgres.query(`drop database if exists ${DB} with (force)`);
  await postgres.query(`create database ${DB}`);
  await postgres.end();

  psql(
    ['-f', join(ROOT, 'supabase', 'test-harness', '00_supabase_stub.sql')],
    'postgres',
  );
  psql([
    '-c',
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations
       (version text primary key, statements text[], name text);`,
  ]);
  apply(BEFORE);

  superuser = new Client(connectionConfig(DB));
  await superuser.connect();

  // --- BOYD'S-shaped records, as a 0028 database holds them ------------------
  await superuser.query(`
    with a as (insert into auth.users (email) values ('admin@boyds.test') returning id)
    insert into users (auth_user_id, email, first_name, role, status)
    select id, 'admin@boyds.test', 'Test Admin', 'ADMIN', 'ACTIVE' from a;

    insert into partners (user_id, name, role_title)
    select id, 'Test Admin', 'Test Partner' from users where email = 'admin@boyds.test';

    with a as (insert into auth.users (email) values ('driver@boyds.test') returning id)
    insert into users (auth_user_id, email, first_name, role, status)
    select id, 'driver@boyds.test', 'Test Driver', 'DRIVER', 'ACTIVE' from a;

    insert into drivers (user_id) select id from users where email = 'driver@boyds.test';

    insert into vehicles (vehicle_code) values ('TEST-VAN-1');

    insert into customers (customer_number, company_name)
    values ('BC-0001', 'TEST CUSTOMER ONE'), ('BC-0002', 'TEST CUSTOMER TWO'),
           ('BC-0007', 'TEST CUSTOMER SEVEN');

    insert into jobs (job_number, customer_id, job_type_id)
    select n, (select id from customers where customer_number = 'BC-0001'),
           (select id from job_types where code = 'SAME_DAY')
      from unnest(array['BJ-${YEAR}-0001', 'BJ-${YEAR}-0002', 'BJ-${YEAR - 1}-0040']) n;

    insert into leads (lead_number, company_name) values ('BL-0003', 'TEST LEAD');

    insert into quotes (quote_number, job_type_id, quoted_price_cents)
    values ('BQ-${YEAR}-0005', (select id from job_types where code = 'SAME_DAY'), 10000);

    insert into invoices (invoice_number, customer_id)
    values ('BI-${YEAR}-0002', (select id from customers where customer_number = 'BC-0002'));

    insert into contracts (contract_number, customer_id, title)
    values ('BK-${YEAR}-0001', (select id from customers where customer_number = 'BC-0002'), 'TEST CONTRACT');

    insert into job_requests (request_number, source, contact_name)
    values ('BR-${YEAR}-0009', 'WEBSITE', 'TEST CONTACT');

    -- Numbered by the old sequence, in the old BI- format that clashed with
    -- invoices.
    insert into incidents (incident_type, severity, vehicle_id, driver_id, description,
                           anyone_injured, police_involved, third_party_involved, goods_affected)
    select (enum_range(null::incident_type))[1], 'MINOR',
           (select id from vehicles), (select id from drivers), 'TEST incident',
           false, false, false, false;
  `);

  for (const table of TABLES) {
    const result = await superuser.query<{ n: string }>(
      `select count(*) as n from ${table}`,
    );
    counts[table] = Number(result.rows[0]!.n);
  }

  // A backup of the 0028 database, with the real script, before the upgrade:
  // the backup BOYD'S would hold if the upgrade had to be undone.
  execFileSync(join(ROOT, 'scripts', 'backup-database.sh'), [BACKUP_DIR], {
    env: { ...process.env, SUPABASE_DB_URL: databaseUrl(DB) },
    stdio: 'ignore',
  });

  apply(AFTER);
}, 180_000);

afterAll(async () => {
  await superuser?.end();
  const postgres = new Client(connectionConfig('postgres'));
  await postgres.connect();
  await postgres.query(`drop database if exists ${DB} with (force)`);
  await postgres.query(`drop database if exists ${RESTORED} with (force)`);
  await postgres.end();
  rmSync(BACKUP_DIR, { recursive: true, force: true });
});

async function next(kind: string): Promise<string> {
  const result = await superuser.query<{ n: string }>(
    `select issue_reference_number((select id from organisations where slug = 'boyds'), $1) as n`,
    [kind],
  );
  return result.rows[0]!.n;
}

describe('upgrading a live 0028 database to companies', () => {
  it('had records to upgrade — the rehearsal is not of an empty database', () => {
    expect(counts.customers).toBe(3);
    expect(counts.jobs).toBe(3);
    expect(counts.incidents).toBe(1);
  });

  it('loses no record', async () => {
    for (const table of TABLES) {
      const result = await superuser.query<{ n: string }>(
        `select count(*) as n from ${table}`,
      );
      // audit_logs only grows; nothing else changes.
      if (table === 'audit_logs') {
        expect(Number(result.rows[0]!.n)).toBeGreaterThanOrEqual(counts[table]!);
      } else {
        expect(Number(result.rows[0]!.n), table).toBe(counts[table]);
      }
    }
  });

  it('gives every existing record to BOYD’S', async () => {
    for (const table of TABLES) {
      const result = await superuser.query<{ slug: string; n: string }>(
        `select o.slug, count(*) as n from ${table} t
           join organisations o on o.id = t.organisation_id group by o.slug`,
      );
      expect(
        result.rows.map((row) => row.slug),
        table,
      ).toEqual(counts[table]! > 0 ? ['boyds'] : []);
    }
  });

  it('carries on from the numbers BOYD’S has already issued', async () => {
    expect(await next('CUSTOMER')).toBe('BC-0008');
    expect(await next('LEAD')).toBe('BL-0004');
    expect(await next('QUOTE')).toBe(
      `BQ-${new Date().getFullYear()}-${
        new Date().getFullYear() === YEAR ? '0006' : '0001'
      }`,
    );
  });

  it('keeps each year’s job numbers separate, as before', async () => {
    const counters = await superuser.query<{ period: number; last_value: number }>(
      `select period, last_value from organisation_counters where kind = 'JOB' order by period`,
    );
    expect(counters.rows).toEqual([
      { period: YEAR - 1, last_value: 40 },
      { period: YEAR, last_value: 2 },
    ]);
  });

  it('continues invoice, contract and request numbers', async () => {
    const counters = await superuser.query<{ kind: string; last_value: number }>(
      `select kind, last_value from organisation_counters
        where kind in ('INVOICE', 'CONTRACT', 'REQUEST') and period = $1 order by kind`,
      [YEAR],
    );
    expect(counters.rows).toEqual([
      { kind: 'CONTRACT', last_value: 1 },
      { kind: 'INVOICE', last_value: 2 },
      { kind: 'REQUEST', last_value: 9 },
    ]);
  });

  it('keeps the old incident number as it was, and numbers new ones so they cannot clash with invoices', async () => {
    const old = await superuser.query<{ incident_number: string }>(
      'select incident_number from incidents',
    );
    expect(old.rows[0]!.incident_number).toMatch(/^BI-\d{4}-0001$/);
    expect(await next('INCIDENT')).toMatch(/^BIR-\d{4}-0001$/);
  });

  it('still lets the admin sign in to their company', async () => {
    const result = await superuser.query<{ slug: string }>(
      `select o.slug from users u join organisations o on o.id = u.organisation_id
        where u.email = 'admin@boyds.test' and u.role = 'ADMIN' and u.status = 'ACTIVE'`,
    );
    expect(result.rows).toEqual([{ slug: 'boyds' }]);
  });

  it('passes production verification afterwards', async () => {
    const migrator = new Client({ ...connectionConfig(DB), user: 'supabase_postgres' });
    await migrator.connect();
    try {
      const sql = readFileSync(join(ROOT, 'scripts', 'verify-production.sql'), 'utf8');
      const result = await migrator.query<{
        check: string;
        result: string;
        detail: string;
      }>(sql);
      expect(result.rows.filter((row) => row.result === 'STOP')).toEqual([]);
    } finally {
      await migrator.end();
    }
  });
});

describe('the live website’s request form, during the switch-over', () => {
  // The site deployed before 0029 calls the form without naming a company.
  const PRE_COMPANY_CALL = `select create_public_job_request(
      p_company_name => 'A Company', p_contact_name => 'A Contact',
      p_contact_email => 'a@example.test', p_contact_phone => null,
      p_pickup_address => '1 Test Street', p_pickup_city => null, p_pickup_state => null,
      p_pickup_zip => null, p_delivery_address => '2 Test Avenue', p_delivery_city => null,
      p_delivery_state => null, p_delivery_zip => null, p_description => null,
      p_pickup_date => null, p_pickup_time => null, p_urgency => null,
      p_is_recurring => false, p_source => 'WEBSITE', p_notes => null) as n`;

  async function asVisitor(): Promise<Client> {
    const client = new Client(connectionConfig(DB));
    await client.connect();
    await client.query('set role anon');
    return client;
  }

  it('keeps working while BOYD’S is the only company, and continues the numbering', async () => {
    const client = await asVisitor();
    try {
      const result = await client.query<{ n: string }>(PRE_COMPANY_CALL);
      expect(result.rows[0]!.n).toBe(
        `BR-${new Date().getFullYear()}-${new Date().getFullYear() === YEAR ? '0010' : '0001'}`,
      );
    } finally {
      await client.end();
    }
  });

  it('refuses once a second company exists, rather than guess whose request it is', async () => {
    await superuser.query(
      `insert into organisations (slug, name, reference_prefix) values ('second-test', 'TEST SECOND', 'S')`,
    );
    const client = await asVisitor();
    try {
      await expect(client.query(PRE_COMPANY_CALL)).rejects.toThrow(/not available/);
    } finally {
      await client.end();
      await superuser.query(`delete from organisations where slug = 'second-test'`);
    }
  });
});

describe('restoring a backup taken before companies', () => {
  it('loads into the current schema, gives everything to BOYD’S, and verifies', async () => {
    execFileSync(join(ROOT, 'supabase', 'reset-test-db.sh'), [], {
      env: { ...process.env, BOYDS_TEST_DB: RESTORED },
      stdio: 'ignore',
    });
    const backup = readdirSync(BACKUP_DIR).find((file) => file.endsWith('.sql'))!;
    // Throws, failing the test, if the script exits non-zero — including on
    // any STOP from production verification.
    execFileSync(
      join(ROOT, 'scripts', 'restore-database.sh'),
      [join(BACKUP_DIR, backup)],
      {
        env: { ...process.env, SUPABASE_DB_URL: databaseUrl(RESTORED) },
        stdio: 'pipe',
      },
    );

    const restored = new Client(connectionConfig(RESTORED));
    await restored.connect();
    try {
      const customers = await restored.query<{ slug: string; n: string }>(
        `select o.slug, count(*) as n from customers c
           join organisations o on o.id = c.organisation_id group by o.slug`,
      );
      expect(customers.rows).toEqual([{ slug: 'boyds', n: '3' }]);

      // The counters caught up with the restored records.
      const next = await restored.query<{ n: string }>(
        `select issue_reference_number((select id from organisations), 'CUSTOMER') as n`,
      );
      expect(next.rows[0]!.n).toBe('BC-0008');

      // The temporary defaults did not outlive the restore.
      const defaults = await restored.query(
        `select 1 from information_schema.columns
          where table_schema = 'public' and column_name = 'organisation_id'
            and column_default is not null`,
      );
      expect(defaults.rowCount).toBe(0);
    } finally {
      await restored.end();
    }
  }, 180_000);
});
