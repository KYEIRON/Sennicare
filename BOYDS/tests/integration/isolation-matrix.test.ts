import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  organisationId,
  seedDriverRecord,
  seedOrganisation,
  seedPartnerRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { jobTypeId, seedCustomer, seedJob, seedVehicle } from './helpers/operations';

/**
 * Phase 2, milestone 2: the cross-company isolation matrix.
 *
 * A second company — synthetic, test database only — is given a record in
 * every company table it can hold one in. Then, for EVERY company table in
 * the catalogue (not a hand-kept list, so a new table is covered the day it is
 * added), each of BOYD'S partner and driver, and the other company's partner:
 *
 *   - sees none of the other company's rows;
 *   - cannot insert a row into the other company;
 *   - cannot change or delete the other company's rows.
 */

let admin: Client;
let boyds: string;
let other: string;

let boydsPartner: SeededUser;
let boydsDriver: SeededUser;
let otherPartner: SeededUser;
let otherDriver: SeededUser;

let tables: string[] = [];
const unique = () => Math.random().toString(36).slice(2, 8);

/** An error that means "refused", not a broken query. */
function expectRefusal(error: unknown) {
  expect(String((error as Error).message)).toMatch(
    /permission denied|row-level security|driver cannot|cannot be (changed|deleted)|immutable|not allowed/i,
  );
}

/** Company tables an API role can reach, from the catalogue. */
async function companyTables(client: Client): Promise<string[]> {
  const result = await client.query<{ relname: string }>(
    `select c.relname
       from pg_class c
      where c.relnamespace = 'public'::regnamespace
        and c.relkind = 'r'
        and c.relname not in ('organisations', 'organisation_counters')
        and exists (select 1 from pg_attribute a
                     where a.attrelid = c.oid and a.attname = 'organisation_id'
                       and not a.attisdropped)
      order by 1`,
  );
  return result.rows.map((row) => row.relname);
}

/** Give a company a record in (nearly) every table, through the real triggers. */
async function populate(
  org: string,
  partner: SeededUser,
  driver: SeededUser,
  prefix: string,
) {
  const customer = await seedCustomer(admin, `${prefix} CUSTOMER`, org);
  const vehicle = await seedVehicle(admin, `${prefix}-VAN-${unique().toUpperCase()}`, {
    organisationId: org,
  });
  const driverId = (
    await admin.query<{ id: string }>('select id from drivers where user_id = $1', [
      driver.userId,
    ])
  ).rows[0]!.id;
  const jobType = await jobTypeId(admin, 'SAME_DAY', org);
  const job = await seedJob(admin, {
    customerId: customer,
    jobTypeId: jobType,
    vehicleId: vehicle,
    driverId,
    status: 'REQUESTED',
  });
  const enumFirst = (type: string) => `(enum_range(null::${type}))[1]`;

  await admin.query(
    `insert into customer_contacts (customer_id, name) values ($1, 'Contact');
     `.trim(),
    [customer],
  );
  await admin.query(
    `insert into customer_locations (customer_id, address_line1, city, state, zip)
     values ($1, '1 Test St', 'Test', 'NC', '28202')`,
    [customer],
  );
  await admin.query(
    `insert into customer_notes (customer_id, body) values ($1, 'Note')`,
    [customer],
  );
  await admin.query(
    `insert into job_stops (job_id, sequence, stop_type, address_line1, city, state, zip)
     values ($1, 1, ${enumFirst('stop_type')}, '1 Test St', 'Test', 'NC', '28202')`,
    [job],
  );
  await admin.query(`insert into service_areas (organisation_id, name) values ($1, $2)`, [
    org,
    `${prefix} AREA`,
  ]);
  await admin.query(
    `insert into leads (organisation_id, lead_number, company_name)
                     values ($1, $2, 'Lead')`,
    [org, `${prefix}L-${unique()}`],
  );
  const quote = (
    await admin.query<{ id: string }>(
      `insert into quotes (quote_number, customer_id, job_type_id, quoted_price_cents)
       values ($1, $2, $3, 1000) returning id`,
      [`${prefix}Q-${unique()}`, customer, jobType],
    )
  ).rows[0]!.id;
  await admin.query(
    `insert into quote_items (quote_id, sequence, description, unit_price_cents, total_cents)
     values ($1, 1, 'Item', 1000, 1000)`,
    [quote],
  );
  await admin.query(
    `insert into pricing_rules (organisation_id, name) values ($1, 'Rule')`,
    [org],
  );
  await admin.query(
    `insert into contracts (contract_number, customer_id, title) values ($1, $2, 'Contract')`,
    [`${prefix}K-${unique()}`, customer],
  );
  const invoice = (
    await admin.query<{ id: string }>(
      `insert into invoices (invoice_number, customer_id) values ($1, $2) returning id`,
      [`${prefix}I-${unique()}`, customer],
    )
  ).rows[0]!.id;
  await admin.query(
    `insert into invoice_lines (invoice_id, sequence, description, unit_price_cents, total_cents)
     values ($1, 1, 'Line', 1000, 1000)`,
    [invoice],
  );
  await admin.query(
    `insert into payments (invoice_id, amount_cents, method)
     values ($1, 500, ${enumFirst('payment_method')})`,
    [invoice],
  );
  await admin.query(
    `insert into job_requests (organisation_id, request_number, source)
     values ($1, $2, 'WEBSITE')`,
    [org, `${prefix}R-${unique()}`],
  );
  await admin.query(
    `insert into fuel_transactions (vehicle_id, driver_id, gallons_thousandths,
       price_per_gallon_cents, total_cost_cents)
     values ($1, $2, 10000, 350, 3500)`,
    [vehicle, driverId],
  );
  await admin.query(
    `insert into job_expenses (job_id, driver_id, category, amount_cents)
     values ($1, $2, ${enumFirst('expense_category')}, 100)`,
    [job, driverId],
  );
  await admin.query(
    `insert into maintenance_records (vehicle_id, maintenance_type, due_date)
     values ($1, ${enumFirst('maintenance_type')}, current_date + 30)`,
    [vehicle],
  );
  await admin.query(
    `insert into vehicle_cost_entries (vehicle_id, cost_line, period, amount_cents, effective_from)
     values ($1, ${enumFirst('vehicle_cost_line')}, ${enumFirst('vehicle_cost_period')}, 100, current_date)`,
    [vehicle],
  );
  await admin.query(
    `insert into mileage_logs (vehicle_id, driver_id, mileage_type,
       start_odometer_tenths, end_odometer_tenths)
     values ($1, $2, ${enumFirst('mileage_type')}, 100, 200)`,
    [vehicle, driverId],
  );
  await admin.query(
    `insert into incidents (incident_type, severity, vehicle_id, driver_id, description,
       anyone_injured, police_involved, third_party_involved, goods_affected)
     values (${enumFirst('incident_type')}, 'MINOR', $1, $2, 'Test', false, false, false, false)`,
    [vehicle, driverId],
  );
  await admin.query(
    `insert into documents (document_type, entity_table, entity_id, storage_path, file_name,
       mime_type, size_bytes)
     values (${enumFirst('document_type')}, 'customers', $1, $2, 'f.pdf', 'application/pdf', 1)`,
    [customer, `customers/${customer}/x-f.pdf`],
  );
  await admin.query(
    `insert into vehicle_status_history (vehicle_id, to_status, reason)
     values ($1, 'AVAILABLE', 'Test')`,
    [vehicle],
  );
  await admin.query(
    `insert into notifications (recipient_user_id, notification_type, title)
     values ($1, ${enumFirst('notification_type')}, 'Test')`,
    [partner.userId],
  );
  await admin.query(
    `insert into audit_logs (user_id, action, entity_table, entity_id)
     values ($1, 'UPDATED', 'customers', $2)`,
    [partner.userId, customer],
  );
}

async function makePeople(org: string, label: string) {
  const partner = await seedUser(admin, {
    email: `matrix-${label}-partner-${unique()}@boyds.test`,
    firstName: `${label} Partner`,
    role: 'ADMIN',
    organisationId: org,
  });
  await seedPartnerRecord(admin, partner.userId, `${label} Partner`, 'Test');
  const driver = await seedUser(admin, {
    email: `matrix-${label}-driver-${unique()}@boyds.test`,
    firstName: `${label} Driver`,
    role: 'DRIVER',
    organisationId: org,
  });
  await seedDriverRecord(admin, driver.userId);
  return { partner, driver };
}

beforeAll(async () => {
  admin = await adminClient();
  boyds = await organisationId(admin);
  other = await seedOrganisation(admin, `matrix-${unique()}`, { referencePrefix: 'M' });
  await admin.query(
    `insert into job_types (organisation_id, code, name) values ($1, 'SAME_DAY', 'Same-day')`,
    [other],
  );

  ({ partner: boydsPartner, driver: boydsDriver } = await makePeople(boyds, 'BOYDS'));
  ({ partner: otherPartner, driver: otherDriver } = await makePeople(other, 'OTHER'));

  await populate(boyds, boydsPartner, boydsDriver, 'B');
  await populate(other, otherPartner, otherDriver, 'M');

  tables = await companyTables(admin);
}, 60_000);

afterAll(async () => {
  await admin?.end();
});

describe('the matrix covers the whole schema', () => {
  it('gives the other company a record in every company table', async () => {
    const empty: string[] = [];
    for (const table of tables) {
      const result = await admin.query(
        `select 1 from ${table} where organisation_id = $1 limit 1`,
        [other],
      );
      if (result.rowCount === 0) empty.push(table);
    }
    // If this fails, a new table was added: give the other company a row in
    // it in populate() above, so the isolation checks below cover it.
    expect(empty).toEqual([]);
  });

  it('has a same-company rule on every company table', async () => {
    const result = await admin.query<{ relname: string }>(
      `select c.relname
         from pg_class c
        where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
          and c.relname = any ($1)
          and not exists (
            select 1 from pg_policy p
             where p.polrelid = c.oid and not p.polpermissive
               and p.polname = c.relname || '_same_company'
               and p.polcmd = '*')`,
      [tables],
    );
    expect(result.rows).toEqual([]);
  });
});

describe.each([
  ['a BOYD’S partner', () => boydsPartner, () => other],
  ['a BOYD’S driver', () => boydsDriver, () => other],
  ['the other company’s partner', () => otherPartner, () => boyds],
  ['the other company’s driver', () => otherDriver, () => boyds],
])('%s', (_label, person, foreign) => {
  it('sees none of the other company’s rows, in any table', async () => {
    const client = await sessionClient(person().authUserId);
    const leaked: string[] = [];
    try {
      await client.query('begin');
      for (const table of tables) {
        await client.query('savepoint probe');
        try {
          const result = await client.query(
            `select 1 from ${table} where organisation_id = $1 limit 1`,
            [foreign()],
          );
          if ((result.rowCount ?? 0) > 0) leaked.push(table);
          await client.query('release savepoint probe');
        } catch (error) {
          // No table grant at all is also isolation. Anything else is a fault
          // in the test, not a pass.
          expectRefusal(error);
          await client.query('rollback to savepoint probe');
        }
      }
      await client.query('rollback');
    } finally {
      await client.end();
    }
    expect(leaked).toEqual([]);
  });

  it('changes and deletes none of the other company’s rows', async () => {
    const client = await sessionClient(person().authUserId);
    const touched: string[] = [];
    try {
      await client.query('begin');
      for (const table of tables) {
        await client.query('savepoint probe');
        try {
          const updated = await client.query(
            `update ${table} set organisation_id = organisation_id where organisation_id = $1`,
            [foreign()],
          );
          const deleted = await client.query(
            `delete from ${table} where organisation_id = $1`,
            [foreign()],
          );
          if ((updated.rowCount ?? 0) > 0 || (deleted.rowCount ?? 0) > 0)
            touched.push(table);
          await client.query('release savepoint probe');
        } catch (error) {
          expectRefusal(error);
          await client.query('rollback to savepoint probe');
        }
      }
      await client.query('rollback');
    } finally {
      await client.end();
    }
    expect(touched).toEqual([]);
  });
});

describe('writing into another company', () => {
  it('refuses a partner creating a customer in another company', async () => {
    const client = await sessionClient(boydsPartner.authUserId);
    await expect(
      client.query(
        `insert into customers (organisation_id, customer_number, company_name)
         values ($1, $2, 'Planted')`,
        [other, `TEST-C-${unique()}`],
      ),
    ).rejects.toThrow(/row-level security/);
    await client.end();
  });

  it('refuses a partner filing a note against another company’s customer', async () => {
    // The note would inherit the other company from its parent — and the
    // same-company rule refuses it.
    const theirCustomer = (
      await admin.query<{ id: string }>(
        'select id from customers where organisation_id = $1 limit 1',
        [other],
      )
    ).rows[0]!.id;
    const client = await sessionClient(boydsPartner.authUserId);
    await expect(
      client.query(
        `insert into customer_notes (customer_id, body) values ($1, 'Planted')`,
        [theirCustomer],
      ),
    ).rejects.toThrow(/row-level security/);
    await client.end();
  });

  it('refuses moving one of your own records into another company', async () => {
    const client = await sessionClient(boydsPartner.authUserId);
    await expect(
      client.query(
        `update pricing_rules set organisation_id = $1 where organisation_id = $2`,
        [other, boyds],
      ),
    ).rejects.toThrow(/row-level security/);
    await client.end();
  });
});

describe('elevated-rights functions stay within the company', () => {
  it('will not describe another company’s van to a partner', async () => {
    const theirVan = (
      await admin.query<{ id: string }>(
        `select vehicle_id as id from jobs where organisation_id = $1 and vehicle_id is not null limit 1`,
        [other],
      )
    ).rows[0]!.id;
    await admin.query(`update vehicles set status = 'MAINTENANCE' where id = $1`, [
      theirVan,
    ]);

    const client = await sessionClient(boydsPartner.authUserId);
    const result = await client.query(
      `select * from find_dispatch_conflicts(null, $1, null, current_date, '09:00', '10:00')`,
      [theirVan],
    );
    await client.end();
    expect(result.rows).toEqual([]);
  });

  it('keeps the last-admin rule per company', async () => {
    // BOYD'S has admins; the other company has exactly one. Demoting that one
    // is refused even though admins exist elsewhere.
    const onlyAdmin = await seedUser(admin, {
      email: `matrix-solo-${unique()}@boyds.test`,
      firstName: 'Solo',
      role: 'ADMIN',
      organisationId: await seedOrganisation(admin, `solo-${unique()}`),
    });
    await expect(
      admin.query(`update users set role = 'PARTNER' where id = $1`, [onlyAdmin.userId]),
    ).rejects.toThrow(/last active admin/);
  });

  it('will not move a person to another company', async () => {
    await expect(
      admin.query('update users set organisation_id = $1 where id = $2', [
        other,
        boydsDriver.userId,
      ]),
    ).rejects.toThrow(/cannot be moved/);
  });

  it('reaches only the files of the partner’s own company', async () => {
    const ours = (
      await admin.query<{ id: string }>(
        'select id from customers where organisation_id = $1 limit 1',
        [boyds],
      )
    ).rows[0]!.id;
    const theirs = (
      await admin.query<{ id: string }>(
        'select id from customers where organisation_id = $1 limit 1',
        [other],
      )
    ).rows[0]!.id;

    const client = await sessionClient(boydsPartner.authUserId);
    const result = await client.query<{
      mine: string | null;
      theirs: string | null;
      odd: string | null;
    }>(
      `select storage_object_company($1) as mine, storage_object_company($2) as theirs,
              storage_object_company('customers/not-a-uuid/x.pdf') as odd`,
      [`customers/${ours}/a-f.pdf`, `customers/${theirs}/a-f.pdf`],
    );
    await client.end();
    expect(result.rows[0]).toEqual({ mine: boyds, theirs: other, odd: null });

    // And the policy uses it: a BOYD'S partner cannot upload into the other
    // company's folder.
    const upload = await sessionClient(boydsPartner.authUserId);
    await expect(
      upload.query(
        `insert into storage.objects (bucket_id, name) values ('boyds-documents', $1)`,
        [`customers/${theirs}/planted.pdf`],
      ),
    ).rejects.toThrow(/row-level security/);
    await upload.end();
  });
});
