import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, sessionClient } from './helpers/db';

/**
 * What the public can EXECUTE.
 *
 * PostgreSQL grants EXECUTE on every new function to PUBLIC by default. BOYD'S
 * had revoked table access from `anon` and then handed it every SECURITY
 * DEFINER function in the schema — a gap found by a security review rather than
 * by any test, which is why these tests exist now.
 *
 * Exactly one function is meant to be reachable by an anonymous visitor.
 */

let admin: Client;

beforeAll(async () => {
  admin = await adminClient();
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('the anonymous surface is one function wide', () => {
  it('lists exactly one BOYD’S function anon may execute', async () => {
    const result = await admin.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       left join pg_depend d
         on d.objid = p.oid and d.deptype = 'e'
       where n.nspname = 'public'
         and d.objid is null
         and has_function_privilege('anon', p.oid, 'execute')
       order by 1`,
    );

    // create_public_job_request is the one entry point. The four helpers are
    // called BY row level security policies during evaluation, as the querying
    // role — without EXECUTE, an anonymous query fails outright. They are safe:
    // for anon they return null and false, which is what the policies need and
    // tells the caller nothing.
    expect(result.rows.map((r) => r.proname)).toEqual([
      'create_public_job_request',
      'current_app_user_id',
      'current_app_user_role',
      'is_driver',
      'is_partner',
    ]);
  });

  it('refuses an anonymous caller raising a notification', async () => {
    // Without this, anyone could bury real alerts in fabricated ones — and at
    // 2am, wake the partners for work that does not exist.
    const client = await sessionClient(null);
    await expect(
      client.query(
        `select notify_partners('NEW_REQUEST', 'URGENT', 'Forged', 'Not real', null, null)`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await client.end();
  });

  it('refuses an anonymous caller enumerating the schedule', async () => {
    const client = await sessionClient(null);
    await expect(
      client.query(
        `select * from find_dispatch_conflicts(null, null, null, '2027-01-01', '09:00', '11:00')`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await client.end();
  });

  it.each(['is_partner()', 'is_driver()'])(
    'tells an anonymous caller %s is false, which is all it can learn',
    async (call) => {
      const client = await sessionClient(null);
      const result = await client.query<Record<string, boolean>>(
        `select ${call} as answer`,
      );
      await client.end();
      expect(result.rows[0]!.answer).toBe(false);
    },
  );

  it('resolves no app user for an anonymous caller', async () => {
    const client = await sessionClient(null);
    const result = await client.query<{ answer: string | null }>(
      'select current_app_user_id() as answer',
    );
    await client.end();
    expect(result.rows[0]!.answer).toBeNull();
  });

  it('refuses an anonymous caller invoking a trigger function', async () => {
    const client = await sessionClient(null);
    for (const fn of ['write_audit_log()', 'rollup_job_expenses()', 'set_updated_at()']) {
      await expect(client.query(`select ${fn}`)).rejects.toThrow(/permission denied/i);
    }
    await client.end();
  });

  it('DOES let an anonymous visitor submit a request', async () => {
    const client = await sessionClient(null);
    const result = await client.query<{ create_public_job_request: string }>(
      `select create_public_job_request(
        'A Company', 'A Contact', 'a@example.test', null,
        '1 Test Street', 'Charlotte', 'NC', '28202',
        '2 Test Avenue', 'Concord', 'NC', '28025',
        'Test goods', null, null, 'STANDARD', false, 'WEBSITE', null
      )`,
    );
    await client.end();

    expect(result.rows[0]!.create_public_job_request).toMatch(/^BR-\d{4}-\d{4}$/);
  });
});

describe('authenticated users get the helpers they need', () => {
  it('lets a signed-in user call the role helpers', async () => {
    const result = await admin.query<{ has: boolean }>(
      `select has_function_privilege('authenticated', 'is_partner()', 'execute') as has`,
    );
    expect(result.rows[0]!.has).toBe(true);
  });

  it('still does not let them raise a notification directly', async () => {
    // Notifications come from triggers. One that can be raised on demand is one
    // that can be forged.
    const result = await admin.query<{ has: boolean }>(
      `select has_function_privilege('authenticated',
        'notify_partners(notification_type, notification_severity, text, text, text, uuid)',
        'execute') as has`,
    );
    expect(result.rows[0]!.has).toBe(false);
  });
});

describe('what stops this gap reappearing', () => {
  it('is this test, not a database default', async () => {
    // ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE FROM PUBLIC was tried and is
    // a silent no-op: PostgreSQL stores an empty ACL as NULL, which it cannot
    // distinguish from the built-in default. So a newly created function IS
    // executable by anon until someone revokes it.
    await admin.query(
      `create or replace function boyds_permission_probe() returns integer
       language sql immutable as $$ select 1 $$`,
    );

    const probeIsPublic = await admin.query<{ has: boolean }>(
      `select has_function_privilege('anon', 'boyds_permission_probe()', 'execute') as has`,
    );

    // Documenting the real behaviour rather than asserting a protection that
    // does not exist. The enumeration test above is what actually catches it:
    // this probe function would appear in that list and fail the build.
    expect(probeIsPublic.rows[0]!.has).toBe(true);

    const enumerated = await admin.query<{ proname: string }>(
      `select p.proname from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
       where n.nspname = 'public' and d.objid is null
         and has_function_privilege('anon', p.oid, 'execute')`,
    );

    expect(enumerated.rows.map((r) => r.proname)).toContain('boyds_permission_probe');

    await admin.query('drop function boyds_permission_probe()');
  });
});
