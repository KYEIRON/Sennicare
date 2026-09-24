import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { jobTypeId, seedCustomer, seedJob } from './helpers/operations';

/**
 * Invoicing at the database.
 *
 * The rule under test throughout: an invoice is PAID only when recorded
 * payments cover it. There is no code path that sets it by hand, so "paid"
 * always means money BOYD'S can point at.
 */

let admin: Client;
let partner: SeededUser;
let driver: SeededUser;
let customerId: string;
let typeId: string;

beforeAll(async () => {
  admin = await adminClient();

  partner = await seedUser(admin, {
    email: 'inv-partner@boyds.test',
    firstName: 'InvPartner',
    role: 'PARTNER',
  });
  await admin.query(
    'insert into partners (user_id, name, role_title) values ($1, $2, $3)',
    [partner.userId, 'InvPartner', 'Test Partner'],
  );

  driver = await seedUser(admin, {
    email: 'inv-driver@boyds.test',
    firstName: 'InvDriver',
    role: 'DRIVER',
  });
  await seedDriverRecord(admin, driver.userId);

  customerId = await seedCustomer(admin, 'INVOICE FIXTURE');
  typeId = await jobTypeId(admin);
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

async function seedInvoice(
  options: { total?: number; dueDate?: string; issueDate?: string } = {},
) {
  const dueDate = options.dueDate ?? '2099-12-31';
  // The issue date must not be after the due date, so an overdue fixture is
  // issued in the past rather than today.
  const issueDate = options.issueDate ?? (dueDate < '2026-01-01' ? '2019-12-01' : null);

  const result = await admin.query<{ id: string }>(
    `insert into invoices (invoice_number, customer_id, status, issue_date, due_date)
     values ($1, $2, 'SENT', coalesce($4::date, current_date), $3) returning id`,
    [`BI-${Math.random().toString(36).slice(2, 10)}`, customerId, dueDate, issueDate],
  );
  const invoiceId = result.rows[0]!.id;

  const jobId = await seedJob(admin, { customerId, jobTypeId: typeId });
  await admin.query(
    `insert into invoice_lines (invoice_id, job_id, sequence, description, unit_price_cents, total_cents)
     values ($1, $2, 1, 'Delivery', $3, $3)`,
    [invoiceId, jobId, options.total ?? 30_000],
  );

  return invoiceId;
}

describe('the invoice total follows its lines', () => {
  it('recalculates when a line is added', async () => {
    const invoiceId = await seedInvoice({ total: 30_000 });
    const result = await admin.query<{ subtotal_cents: string; total_cents: string }>(
      'select subtotal_cents, total_cents from invoices where id = $1',
      [invoiceId],
    );

    expect(Number(result.rows[0]!.subtotal_cents)).toBe(30_000);
    expect(Number(result.rows[0]!.total_cents)).toBe(30_000);
  });

  it('recalculates when a line is removed', async () => {
    const invoiceId = await seedInvoice({ total: 30_000 });
    await admin.query('delete from invoice_lines where invoice_id = $1', [invoiceId]);

    const result = await admin.query<{ total_cents: string }>(
      'select total_cents from invoices where id = $1',
      [invoiceId],
    );
    expect(Number(result.rows[0]!.total_cents)).toBe(0);
  });
});

describe('an invoice is PAID only when payments cover it', () => {
  it('cannot be marked PAID by hand', async () => {
    const invoiceId = await seedInvoice();
    await expect(
      admin.query("update invoices set status = 'PAID' where id = $1", [invoiceId]),
    ).rejects.toThrow(/recorded payments cover its total/i);
  });

  it('cannot have amount_paid set by hand', async () => {
    const invoiceId = await seedInvoice();
    await expect(
      admin.query('update invoices set amount_paid_cents = 30000 where id = $1', [
        invoiceId,
      ]),
    ).rejects.toThrow(/derived from recorded payments/i);
  });

  it('stays unpaid on a partial payment', async () => {
    const invoiceId = await seedInvoice({ total: 30_000 });
    await admin.query(
      `insert into payments (invoice_id, amount_cents, method) values ($1, 10000, 'BANK_TRANSFER')`,
      [invoiceId],
    );

    const result = await admin.query<{ status: string; amount_paid_cents: string }>(
      'select status, amount_paid_cents from invoices where id = $1',
      [invoiceId],
    );

    expect(result.rows[0]!.status).not.toBe('PAID');
    expect(Number(result.rows[0]!.amount_paid_cents)).toBe(10_000);
  });

  it('becomes PAID when payments cover the total', async () => {
    const invoiceId = await seedInvoice({ total: 30_000 });
    await admin.query(
      `insert into payments (invoice_id, amount_cents, method) values ($1, 30000, 'CHECK')`,
      [invoiceId],
    );

    const result = await admin.query<{ status: string; paid_at: Date | null }>(
      'select status, paid_at from invoices where id = $1',
      [invoiceId],
    );

    expect(result.rows[0]!.status).toBe('PAID');
    expect(result.rows[0]!.paid_at).not.toBeNull();
  });

  it('becomes PAID across several part payments', async () => {
    const invoiceId = await seedInvoice({ total: 30_000 });
    for (const amount of [10_000, 10_000, 10_000]) {
      await admin.query(
        `insert into payments (invoice_id, amount_cents, method) values ($1, $2, 'CARD')`,
        [invoiceId, amount],
      );
    }

    const result = await admin.query<{ status: string }>(
      'select status from invoices where id = $1',
      [invoiceId],
    );
    expect(result.rows[0]!.status).toBe('PAID');
  });

  it('returns to DUE when a payment is reversed', async () => {
    const invoiceId = await seedInvoice({ total: 30_000 });
    const payment = await admin.query<{ id: string }>(
      `insert into payments (invoice_id, amount_cents, method) values ($1, 30000, 'CHECK')
       returning id`,
      [invoiceId],
    );

    const paid = await admin.query<{ status: string }>(
      'select status from invoices where id = $1',
      [invoiceId],
    );
    expect(paid.rows[0]!.status).toBe('PAID');

    // A bounced cheque must not leave the invoice claiming to be settled.
    await admin.query('delete from payments where id = $1', [payment.rows[0]!.id]);

    const after = await admin.query<{
      status: string;
      amount_paid_cents: string;
      paid_at: Date | null;
    }>('select status, amount_paid_cents, paid_at from invoices where id = $1', [
      invoiceId,
    ]);

    expect(after.rows[0]!.status).toBe('DUE');
    expect(Number(after.rows[0]!.amount_paid_cents)).toBe(0);
    expect(after.rows[0]!.paid_at).toBeNull();
  });

  it('returns to OVERDUE when a reversed payment is past its due date', async () => {
    const invoiceId = await seedInvoice({ total: 30_000, dueDate: '2020-01-01' });
    const payment = await admin.query<{ id: string }>(
      `insert into payments (invoice_id, amount_cents, method) values ($1, 30000, 'CHECK')
       returning id`,
      [invoiceId],
    );
    await admin.query('delete from payments where id = $1', [payment.rows[0]!.id]);

    const result = await admin.query<{ status: string }>(
      'select status from invoices where id = $1',
      [invoiceId],
    );
    expect(result.rows[0]!.status).toBe('OVERDUE');
  });

  it('rejects a zero or negative payment', async () => {
    const invoiceId = await seedInvoice();
    await expect(
      admin.query(
        `insert into payments (invoice_id, amount_cents, method) values ($1, 0, 'CASH')`,
        [invoiceId],
      ),
    ).rejects.toThrow(/amount_positive/i);
  });
});

describe('invoice integrity', () => {
  it('requires issue and due dates before an invoice is sent', async () => {
    await expect(
      admin.query(
        `insert into invoices (invoice_number, customer_id, status) values ($1, $2, 'SENT')`,
        [`BI-${Math.random().toString(36).slice(2, 10)}`, customerId],
      ),
    ).rejects.toThrow(/sent_has_dates/i);
  });

  it('refuses a due date before the issue date', async () => {
    await expect(
      admin.query(
        `insert into invoices (invoice_number, customer_id, status, issue_date, due_date)
         values ($1, $2, 'SENT', '2026-06-01', '2026-05-01')`,
        [`BI-${Math.random().toString(36).slice(2, 10)}`, customerId],
      ),
    ).rejects.toThrow(/due_after_issue/i);
  });

  it('requires a reason to cancel', async () => {
    const invoiceId = await seedInvoice();
    await expect(
      admin.query("update invoices set status = 'CANCELLED' where id = $1", [invoiceId]),
    ).rejects.toThrow(/cancelled_has_reason/i);
  });

  it('keeps a cancelled invoice cancelled even if money arrives', async () => {
    const invoiceId = await seedInvoice({ total: 30_000 });
    await admin.query(
      "update invoices set status = 'CANCELLED', cancellation_reason = 'Duplicate' where id = $1",
      [invoiceId],
    );
    await admin.query(
      `insert into payments (invoice_id, amount_cents, method) values ($1, 30000, 'CASH')`,
      [invoiceId],
    );

    const result = await admin.query<{ status: string }>(
      'select status from invoices where id = $1',
      [invoiceId],
    );
    expect(result.rows[0]!.status).toBe('CANCELLED');
  });
});

describe('contracts', () => {
  it('requires a start date before a contract is active', async () => {
    await expect(
      admin.query(
        `insert into contracts (contract_number, customer_id, title, status)
         values ($1, $2, 'Weekly run', 'ACTIVE')`,
        [`BCT-${Math.random().toString(36).slice(2, 8)}`, customerId],
      ),
    ).rejects.toThrow(/active_has_start/i);
  });

  it('allows a contract with no agreed rate yet', async () => {
    // An unpriced contract is not a free one; the rate simply is not agreed.
    const result = await admin.query<{ agreed_rate_cents: string | null }>(
      `insert into contracts (contract_number, customer_id, title)
       values ($1, $2, 'Rate to be agreed') returning agreed_rate_cents`,
      [`BCT-${Math.random().toString(36).slice(2, 8)}`, customerId],
    );
    expect(result.rows[0]!.agreed_rate_cents).toBeNull();
  });

  it('refuses an end date before the start date', async () => {
    await expect(
      admin.query(
        `insert into contracts (contract_number, customer_id, title, start_date, end_date)
         values ($1, $2, 'Backwards', '2026-06-01', '2026-01-01')`,
        [`BCT-${Math.random().toString(36).slice(2, 8)}`, customerId],
      ),
    ).rejects.toThrow(/dates_sane/i);
  });
});

describe('money is partner-only', () => {
  it.each(['invoices', 'invoice_lines', 'payments', 'contracts'])(
    'shows a driver zero rows in %s',
    async (table) => {
      await seedInvoice();
      const client = await sessionClient(driver.authUserId);
      const result = await client.query(`select 1 from ${table}`);
      await client.end();
      expect(result.rowCount).toBe(0);
    },
  );

  it('does not let a driver record a payment', async () => {
    const invoiceId = await seedInvoice();
    const client = await sessionClient(driver.authUserId);
    await expect(
      client.query(
        `insert into payments (invoice_id, amount_cents, method) values ($1, 100, 'CASH')`,
        [invoiceId],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.end();
  });

  it('lets a partner record a payment', async () => {
    const invoiceId = await seedInvoice({ total: 5_000 });
    const client = await sessionClient(partner.authUserId);
    const result = await client.query(
      `insert into payments (invoice_id, amount_cents, method) values ($1, 5000, 'BANK_TRANSFER')`,
      [invoiceId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });
});

describe('every table still has row level security', () => {
  it('leaves nothing unprotected', async () => {
    const result = await admin.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' and rowsecurity = false`,
    );
    expect(result.rows.map((r) => r.tablename)).toEqual([]);
  });
});
