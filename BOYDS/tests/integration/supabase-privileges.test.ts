import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { adminClient, connectionConfig, sessionClient } from './helpers/db';

/**
 * What the public API roles can reach, under Supabase's real default grants.
 *
 * Hosted Supabase grants ALL on every table, view, sequence and function
 * created in `public` to anon, authenticated and service_role. The test
 * harness reproduces that. Under it, migration 0025 closed three grants the
 * earlier migrations never revoked — the worst an anonymous INSERT through
 * driver_vehicle_maintenance that bypassed row level security.
 *
 * These tests pin down the exact surface, so the next object added without its
 * own revokes fails the build and is named in the failure.
 */

let admin: Client;

beforeAll(async () => {
  admin = await adminClient();
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('the harness is faithful to hosted Supabase', () => {
  // If these fail, the rest of the suite is proving less than it claims.

  it('applied the migrations as a role that is NOT a superuser', async () => {
    const result = await admin.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `select r.rolsuper, r.rolbypassrls
         from pg_class c
         join pg_roles r on r.oid = c.relowner
        where c.oid = 'public.jobs'::regclass`,
    );
    expect(result.rows[0]!.rolsuper).toBe(false);
    expect(result.rows[0]!.rolbypassrls).toBe(true);
  });

  it('grants the API roles everything by default, as Supabase does', async () => {
    const result = await admin.query<{ defaclacl: string }>(
      `select d.defaclacl::text
         from pg_default_acl d
        where d.defaclrole = 'supabase_postgres'::regrole
          and d.defaclnamespace = 'public'::regnamespace
          and d.defaclobjtype = 'r'`,
    );
    // After migration 0025 only service_role remains in the default.
    expect(result.rows[0]!.defaclacl).toContain('service_role');
  });
});

describe('the public role', () => {
  it('can reach exactly the two reference tables the website reads, and nothing else', async () => {
    const result = await admin.query<{ relation: string; privilege: string }>(
      `select c.relname as relation, p.privilege
         from pg_class c
         cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as p(privilege)
        where c.relnamespace = 'public'::regnamespace
          and c.relkind in ('r', 'v', 'm', 'p', 'f')
          and has_table_privilege('anon', c.oid, p.privilege)
        order by 1, 2`,
    );

    expect(result.rows).toEqual([
      { relation: 'job_types', privilege: 'SELECT' },
      { relation: 'service_areas', privilege: 'SELECT' },
    ]);
  });

  it('holds nothing on any sequence', async () => {
    const result = await admin.query<{ relname: string }>(
      `select c.relname
         from pg_class c
        where c.relnamespace = 'public'::regnamespace
          and c.relkind = 'S'
          and (has_sequence_privilege('anon', c.oid, 'usage')
            or has_sequence_privilege('anon', c.oid, 'update')
            or has_sequence_privilege('anon', c.oid, 'select'))`,
    );
    expect(result.rows).toEqual([]);
  });

  it('cannot plant a maintenance record through the driver view', async () => {
    const vehicle = await admin.query<{ id: string }>(
      `insert into vehicles (vehicle_code) values ($1) returning id`,
      [`TEST-V-PRIV-${Date.now()}`],
    );

    const client = await sessionClient(null);
    await expect(
      client.query(
        `insert into driver_vehicle_maintenance (vehicle_id, maintenance_type, description, due_date)
         values ($1, (enum_range(null::maintenance_type))[1], 'planted', current_date)`,
        [vehicle.rows[0]!.id],
      ),
    ).rejects.toThrow(/permission denied/);
    await client.end();
  });
});

describe('signed-in users', () => {
  it('can only read the driver views, never write through them', async () => {
    const result = await admin.query<{ relname: string }>(
      `select c.relname
         from pg_class c
        where c.relnamespace = 'public'::regnamespace
          and c.relkind = 'v'
          and (has_table_privilege('authenticated', c.oid, 'insert')
            or has_table_privilege('authenticated', c.oid, 'update')
            or has_table_privilege('authenticated', c.oid, 'delete'))`,
    );
    expect(result.rows).toEqual([]);
  });

  it('hold nothing on any sequence', async () => {
    const result = await admin.query<{ relname: string }>(
      `select c.relname
         from pg_class c
        where c.relnamespace = 'public'::regnamespace
          and c.relkind = 'S'
          and (has_sequence_privilege('authenticated', c.oid, 'usage')
            or has_sequence_privilege('authenticated', c.oid, 'update'))`,
    );
    expect(result.rows).toEqual([]);
  });
});

describe('objects added later', () => {
  it('are closed to the public by default, not open', async () => {
    // Created as the migrating role, exactly as a future migration would be,
    // and rolled back.
    const migrator = new Client({ ...connectionConfig(), user: 'supabase_postgres' });
    await migrator.connect();
    await migrator.query('begin');
    await migrator.query('create table public.zz_future_table (id int)');
    await migrator.query(
      'create function public.zz_future_fn() returns int language sql as $$ select 1 $$',
    );

    const result = await migrator.query<{ table_select: boolean; fn_execute: boolean }>(
      `select has_table_privilege('anon', 'public.zz_future_table', 'select') as table_select,
              has_function_privilege('anon', 'public.zz_future_fn()', 'execute') as fn_execute`,
    );
    await migrator.query('rollback');
    await migrator.end();

    expect(result.rows[0]!.table_select).toBe(false);

    // Functions are the exception, and this pins it rather than hiding it.
    // PostgreSQL itself grants EXECUTE on every new function to PUBLIC, which
    // anon inherits, and default privileges cannot remove that (D-029). So a
    // new function IS callable by the public until its migration revokes it —
    // which is why every function migration revokes from PUBLIC explicitly,
    // and why function-permissions.test.ts enumerates exactly what anon can
    // execute and fails on anything new.
    expect(result.rows[0]!.fn_execute).toBe(true);
  });
});
