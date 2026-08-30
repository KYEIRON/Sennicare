import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient, seedPartnerRecord, seedUser, sessionClient } from './helpers/db';
import { seedCustomer } from './helpers/operations';

/**
 * The customer record a partner works from.
 *
 * The page shows people, addresses and notes for one customer. What makes that
 * record trustworthy is in the database: one main contact and no more, an
 * address that has to be a real US address, and a note that cannot be blank.
 */

let admin: Client;
let partner: { authUserId: string; userId: string };

beforeAll(async () => {
  admin = await adminClient();

  const partnerUser = await seedUser(admin, {
    email: `record-partner-${Date.now()}@boyds.test`,
    firstName: 'Test',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, partnerUser.userId, 'Test Partner', 'Test Role');
  partner = partnerUser;
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('a partner builds up a customer record', () => {
  it('adds a contact, an address and a note', async () => {
    const customerId = await seedCustomer(admin, 'A Test Company');
    const client = await sessionClient(partner.authUserId);

    await client.query(
      `insert into customer_contacts (customer_id, name, role, phone, is_primary)
       values ($1, 'A Test Contact', 'PRIMARY', '555-0100', true)`,
      [customerId],
    );
    await client.query(
      `insert into customer_locations (customer_id, kind, label, address_line1, city, state, zip)
       values ($1, 'PICKUP', 'Test dock', '1 Test Street', 'Charlotte', 'NC', '28202')`,
      [customerId],
    );
    await client.query(
      `insert into customer_notes (customer_id, body, created_by)
       values ($1, 'They asked us to call ahead.', $2)`,
      [customerId, partner.userId],
    );
    await client.end();

    const counts = await admin.query<{
      contacts: string;
      locations: string;
      notes: string;
    }>(
      `select
         (select count(*) from customer_contacts where customer_id = $1) as contacts,
         (select count(*) from customer_locations where customer_id = $1) as locations,
         (select count(*) from customer_notes where customer_id = $1) as notes`,
      [customerId],
    );

    expect(counts.rows[0]).toEqual({ contacts: '1', locations: '1', notes: '1' });
  });

  it('keeps the customer’s headline contact in step with the real one', async () => {
    const customerId = await seedCustomer(admin, 'A Test Company');
    const client = await sessionClient(partner.authUserId);

    await client.query(
      `insert into customer_contacts (customer_id, name, role, phone, email, is_primary)
       values ($1, 'A Test Contact', 'PRIMARY', '555-0100', 'contact@example.test', true)`,
      [customerId],
    );
    await client.end();

    const customer = await admin.query<{
      primary_contact_name: string;
      primary_contact_phone: string;
    }>(
      'select primary_contact_name, primary_contact_phone from customers where id = $1',
      [customerId],
    );

    expect(customer.rows[0]!.primary_contact_name).toBe('A Test Contact');
    expect(customer.rows[0]!.primary_contact_phone).toBe('555-0100');
  });

  it('allows only one main contact', async () => {
    const customerId = await seedCustomer(admin, 'A Test Company');
    const client = await sessionClient(partner.authUserId);

    await client.query(
      `insert into customer_contacts (customer_id, name, is_primary)
       values ($1, 'A Test Contact', true)`,
      [customerId],
    );

    await expect(
      client.query(
        `insert into customer_contacts (customer_id, name, is_primary)
         values ($1, 'Another Test Contact', true)`,
        [customerId],
      ),
    ).rejects.toThrow(/customer_contacts_one_primary/);

    await client.end();
  });

  it('refuses a blank note', async () => {
    const customerId = await seedCustomer(admin, 'A Test Company');
    await expect(
      admin.query('insert into customer_notes (customer_id, body) values ($1, $2)', [
        customerId,
        '   ',
      ]),
    ).rejects.toThrow(/customer_notes_body_present/);
  });

  it('refuses an address that is not a US address', async () => {
    const customerId = await seedCustomer(admin, 'A Test Company');
    await expect(
      admin.query(
        `insert into customer_locations (customer_id, address_line1, city, state, zip)
         values ($1, '1 Test Street', 'Charlotte', 'North Carolina', '28202')`,
        [customerId],
      ),
    ).rejects.toThrow(/customer_locations_state_shape/);

    await expect(
      admin.query(
        `insert into customer_locations (customer_id, address_line1, city, state, zip)
         values ($1, '1 Test Street', 'Charlotte', 'NC', 'not-a-zip')`,
        [customerId],
      ),
    ).rejects.toThrow(/customer_locations_zip_shape/);
  });

  it('leaves payment terms NOT CONFIGURED rather than inventing them', async () => {
    const customerId = await seedCustomer(admin, 'A Test Company');
    const result = await admin.query<{ payment_terms_days: number | null }>(
      'select payment_terms_days from customers where id = $1',
      [customerId],
    );
    expect(result.rows[0]!.payment_terms_days).toBeNull();
  });
});
