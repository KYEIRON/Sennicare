import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  adminClient,
  seedDriverRecord,
  seedPartnerRecord,
  seedUser,
  sessionClient,
  type SeededUser,
} from './helpers/db';
import { jobTypeId, seedVehicle } from './helpers/operations';
import {
  calculateContribution,
  calculateContributionMargin,
  calculateContributionPerMile,
  calculateEmptyMileage,
  costInputsFromRow,
} from '@/services/finance/job-costs';
import { formatBps, formatCents } from '@/lib/format';

/**
 * THE REQUIRED END-TO-END TEST (master instruction section 66).
 *
 * One job, the whole business, through the real database with every trigger,
 * policy and constraint in force. Ronald creates a customer and a quote; the
 * quote is accepted; a job is created and dispatched; Moh accepts it, drives
 * it, captures proof, records mileage, fuel and an expense; the job completes;
 * and BOYD'S calculates what it actually earned.
 *
 * Every step runs as the person who would really perform it — Ronald as a
 * partner, Moh as a driver — so the security boundary is exercised by the same
 * test that exercises the workflow.
 */

let admin: Client;
let ronald: SeededUser;
let moh: SeededUser;
let mohDriverId: string;
let customerId: string;
let vehicleId: string;
let typeId: string;
let jobId: string;
let jobNumber: string;

beforeAll(async () => {
  admin = await adminClient();

  ronald = await seedUser(admin, {
    email: 'e2e-partner@boyds.test',
    firstName: 'E2EPartner',
    role: 'PARTNER',
  });
  await seedPartnerRecord(admin, ronald.userId, 'E2EPartner', 'Business & Operations');

  moh = await seedUser(admin, {
    email: 'e2e-driver@boyds.test',
    firstName: 'E2EDriver',
    role: 'DRIVER',
  });
  mohDriverId = await seedDriverRecord(admin, moh.userId);

  typeId = await jobTypeId(admin, 'SAME_DAY');
  vehicleId = await seedVehicle(admin, 'E2E-VAN');
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('1. Ronald creates a customer', () => {
  it('creates it as a partner', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query<{ id: string }>(
      `insert into customers (customer_number, company_name, customer_type, customer_status, created_by)
       values ('E2E-C-0001', 'E2E TEST CUSTOMER', 'BUSINESS', 'ACTIVE', $1) returning id`,
      [ronald.userId],
    );
    await client.end();

    customerId = result.rows[0]!.id;
    expect(customerId).toBeTruthy();
  });
});

describe('2. Ronald quotes for the work', () => {
  let quoteId: string;

  it('creates a quote', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query<{ id: string }>(
      `insert into quotes (quote_number, customer_id, job_type_id, quoted_price_cents,
        estimated_miles_tenths, valid_until, status, created_by)
       values ('E2E-Q-0001', $1, $2, 30000, 250, '2099-12-31', 'SENT', $3) returning id`,
      [customerId, typeId, ronald.userId],
    );
    await client.end();

    quoteId = result.rows[0]!.id;
    expect(quoteId).toBeTruthy();
  });

  it('the customer accepts it', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query(
      "update quotes set status = 'ACCEPTED' where id = $1",
      [quoteId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });
});

describe('3. A job is created from the accepted quote', () => {
  it('creates the job at APPROVED, carrying the agreed price', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query<{ id: string; job_number: string }>(
      `insert into jobs (job_number, customer_id, job_type_id, status, priority,
        won_price_cents, estimated_miles_tenths, scheduled_date, scheduled_time,
        scheduled_window_end, created_by)
       values ('E2E-J-0001', $1, $2, 'APPROVED', 'SAME_DAY', 30000, 250,
               '2029-03-15', '09:00', '12:00', $3)
       returning id, job_number`,
      [customerId, typeId, ronald.userId],
    );
    await client.end();

    jobId = result.rows[0]!.id;
    jobNumber = result.rows[0]!.job_number;
    expect(jobNumber).toBe('E2E-J-0001');
  });

  it('adds a collection and a delivery stop', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query(
      `insert into job_stops (job_id, sequence, stop_type, address_line1, city, state, zip)
       values ($1, 1, 'PICKUP', '1 Test Street', 'Charlotte', 'NC', '28202'),
              ($1, 2, 'DELIVERY', '2 Test Avenue', 'Concord', 'NC', '28025')`,
      [jobId],
    );
    await client.end();
    expect(result.rowCount).toBe(2);
  });
});

describe('4. Ronald dispatches the job to Moh', () => {
  it('schedules it', async () => {
    const client = await sessionClient(ronald.authUserId);
    await client.query("update jobs set status = 'SCHEDULED' where id = $1", [jobId]);
    await client.end();
  });

  it('assigns the van and the driver', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query(
      "update jobs set status = 'ASSIGNED', vehicle_id = $2, driver_id = $3 where id = $1",
      [jobId, vehicleId, mohDriverId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('marks the van assigned and Moh on the job', async () => {
    const vehicle = await admin.query<{ status: string }>(
      'select status from vehicles where id = $1',
      [vehicleId],
    );
    const driver = await admin.query<{ availability: string }>(
      'select availability from drivers where id = $1',
      [mohDriverId],
    );

    expect(vehicle.rows[0]!.status).toBe('ASSIGNED');
    expect(driver.rows[0]!.availability).toBe('ON_JOB');
  });
});

describe('5. Moh sees the job — and only what he should', () => {
  it('sees it through the driver view', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query<{
      job_number: string;
      customer_company_name: string;
    }>('select job_number, customer_company_name from driver_jobs');
    await client.end();

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]!.job_number).toBe(jobNumber);
    expect(result.rows[0]!.customer_company_name).toBe('E2E TEST CUSTOMER');
  });

  it('cannot see the price on it', async () => {
    const columns = await admin.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'driver_jobs'`,
    );
    const names = columns.rows.map((r) => r.column_name);

    expect(names.filter((n) => n.includes('price'))).toEqual([]);
    expect(names.filter((n) => n.includes('cost'))).toEqual([]);
  });

  it('cannot see the customer record', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query('select id from customers');
    await client.end();
    expect(result.rowCount).toBe(0);
  });

  it('cannot see the quote', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query('select id from quotes');
    await client.end();
    expect(result.rowCount).toBe(0);
  });
});

describe('6. Moh drives the job', () => {
  async function advance(status: string) {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query('update jobs set status = $2 where id = $1', [
      jobId,
      status,
    ]);
    await client.end();
    return result;
  }

  it('accepts it', async () => {
    expect((await advance('DRIVER_ACCEPTED')).rowCount).toBe(1);
  });

  it('sets off for the collection', async () => {
    expect((await advance('EN_ROUTE_TO_PICKUP')).rowCount).toBe(1);
  });

  it('marks the van in transit', async () => {
    const result = await admin.query<{ status: string }>(
      'select status from vehicles where id = $1',
      [vehicleId],
    );
    expect(result.rows[0]!.status).toBe('IN_TRANSIT');
  });

  it('arrives and collects', async () => {
    expect((await advance('AT_PICKUP')).rowCount).toBe(1);
    expect((await advance('PICKED_UP')).rowCount).toBe(1);
  });

  it('uploads a collection photo', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query(
      `insert into documents (document_type, entity_table, entity_id, storage_path,
        file_name, mime_type, size_bytes, uploaded_by)
       values ('PICKUP_PHOTO', 'jobs', $1, $2, 'collection.jpg', 'image/jpeg', 180000, $3)`,
      [jobId, `jobs/${jobId}/e2e-collection.jpg`, moh.userId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('drives to the delivery and hands over', async () => {
    expect((await advance('IN_TRANSIT')).rowCount).toBe(1);
    expect((await advance('AT_DELIVERY')).rowCount).toBe(1);
    expect((await advance('DELIVERED')).rowCount).toBe(1);
  });
});

describe('7. Proof of delivery', () => {
  it('refuses POD_RECEIVED before any proof exists', async () => {
    // The collection photo is not proof of DELIVERY.
    await admin.query('delete from documents where entity_id = $1', [jobId]);

    const client = await sessionClient(moh.authUserId);
    await expect(
      client.query("update jobs set status = 'POD_RECEIVED' where id = $1", [jobId]),
    ).rejects.toThrow(/requires proof of delivery/i);
    await client.end();
  });

  it('accepts a signature with the recipient’s name', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query(
      `insert into documents (document_type, entity_table, entity_id, storage_path,
        file_name, mime_type, size_bytes, signed_by_name, uploaded_by)
       values ('SIGNATURE', 'jobs', $1, $2, 'signature.png', 'image/png', 3200,
               'Recipient name as given', $3)`,
      [jobId, `jobs/${jobId}/e2e-signature.png`, moh.userId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('now allows POD_RECEIVED', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query(
      "update jobs set status = 'POD_RECEIVED' where id = $1",
      [jobId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });
});

describe('8. Moh records the real numbers', () => {
  it('records mileage, split loaded and empty', async () => {
    const client = await sessionClient(moh.authUserId);
    const result = await client.query(
      `update jobs set actual_miles_tenths = 250, loaded_miles_tenths = 190,
       empty_miles_tenths = 60, start_odometer_tenths = 1000000,
       end_odometer_tenths = 1000250 where id = $1`,
      [jobId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('records fuel, which creates the expense automatically', async () => {
    const client = await sessionClient(moh.authUserId);
    await client.query(
      `insert into fuel_transactions (vehicle_id, driver_id, job_id, gallons_thousandths,
        price_per_gallon_cents, total_cost_cents, odometer_tenths, recorded_by)
       values ($1, $2, $3, 20000, 400, 8000, 1000250, $4)`,
      [vehicleId, mohDriverId, jobId, moh.userId],
    );
    await client.end();

    const expense = await admin.query<{ category: string; amount_cents: string }>(
      "select category, amount_cents from job_expenses where job_id = $1 and category = 'FUEL'",
      [jobId],
    );
    expect(Number(expense.rows[0]!.amount_cents)).toBe(8000);
  });

  it('records a toll and a parking charge', async () => {
    const client = await sessionClient(moh.authUserId);
    await client.query(
      `insert into job_expenses (job_id, vehicle_id, driver_id, category, amount_cents, recorded_by)
       values ($1, $2, $3, 'TOLL', 2000, $4), ($1, $2, $3, 'PARKING', 1000, $4)`,
      [jobId, vehicleId, mohDriverId, moh.userId],
    );
    await client.end();

    const result = await admin.query<{
      toll_cost_actual_cents: string;
      parking_cost_actual_cents: string;
    }>(
      'select toll_cost_actual_cents, parking_cost_actual_cents from jobs where id = $1',
      [jobId],
    );

    expect(Number(result.rows[0]!.toll_cost_actual_cents)).toBe(2000);
    expect(Number(result.rows[0]!.parking_cost_actual_cents)).toBe(1000);
  });

  it('still cannot change the price', async () => {
    const client = await sessionClient(moh.authUserId);
    await expect(
      client.query('update jobs set won_price_cents = 99999 where id = $1', [jobId]),
    ).rejects.toThrow(/not pricing, assignment or internal notes/i);
    await client.end();
  });
});

describe('9. Contribution is DATA INCOMPLETE until every cost is in', () => {
  it('refuses a contribution while driver and vehicle costs are missing', async () => {
    const row = await admin.query(
      `select won_price_cents, actual_miles_tenths, loaded_miles_tenths, empty_miles_tenths,
        fuel_cost_estimated_cents, fuel_cost_actual_cents,
        driver_cost_estimated_cents, driver_cost_actual_cents,
        vehicle_cost_estimated_cents, vehicle_cost_actual_cents,
        toll_cost_estimated_cents, toll_cost_actual_cents,
        parking_cost_estimated_cents, parking_cost_actual_cents,
        other_cost_estimated_cents, other_cost_actual_cents
       from jobs where id = $1`,
      [jobId],
    );

    const result = calculateContribution(
      costInputsFromRow(row.rows[0] as never),
      'ACTUAL',
    );

    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['driver_cost', 'vehicle_cost', 'other_cost']);
    }
  });
});

describe('10. Ronald completes the costs and the job', () => {
  it('records the remaining costs as a partner', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query(
      `update jobs set driver_cost_actual_cents = 7000, vehicle_cost_actual_cents = 4000,
       other_cost_actual_cents = 2000 where id = $1`,
      [jobId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('completes the job', async () => {
    const client = await sessionClient(ronald.authUserId);
    const result = await client.query(
      "update jobs set status = 'COMPLETED' where id = $1",
      [jobId],
    );
    await client.end();
    expect(result.rowCount).toBe(1);
  });

  it('releases the van and the driver', async () => {
    const vehicle = await admin.query<{ status: string }>(
      'select status from vehicles where id = $1',
      [vehicleId],
    );
    const driver = await admin.query<{ availability: string }>(
      'select availability from drivers where id = $1',
      [mohDriverId],
    );

    expect(vehicle.rows[0]!.status).toBe('AVAILABLE');
    expect(driver.rows[0]!.availability).toBe('AVAILABLE');
  });
});

describe('11. BOYD’S calculates what it actually earned', () => {
  it('produces the right figures, and never reports revenue as profit', async () => {
    const row = await admin.query(
      `select won_price_cents, actual_miles_tenths, loaded_miles_tenths, empty_miles_tenths,
        fuel_cost_estimated_cents, fuel_cost_actual_cents,
        driver_cost_estimated_cents, driver_cost_actual_cents,
        vehicle_cost_estimated_cents, vehicle_cost_actual_cents,
        toll_cost_estimated_cents, toll_cost_actual_cents,
        parking_cost_estimated_cents, parking_cost_actual_cents,
        other_cost_estimated_cents, other_cost_actual_cents
       from jobs where id = $1`,
      [jobId],
    );

    const inputs = costInputsFromRow(row.rows[0] as never);
    const contribution = calculateContribution(inputs, 'ACTUAL');

    expect(contribution.status).toBe('OK');
    if (contribution.status !== 'OK') return;

    // Revenue $300.00 against fuel $80, driver $70, vehicle $40, tolls $20,
    // parking $10 and other $20 — a $240 cost stack.
    expect(formatCents(contribution.value.revenue)).toBe('$300.00');
    expect(formatCents(contribution.value.totalCost)).toBe('$240.00');
    expect(formatCents(contribution.value.contribution)).toBe('$60.00');

    // The rule the whole system exists to uphold.
    expect(formatCents(contribution.value.contribution)).not.toBe('$300.00');
    expect(contribution.value.labourTreatment).toBe('LABOUR_COSTED');

    // $60 across 25.0 miles.
    expect(calculateContributionPerMile(inputs, 'ACTUAL')).toEqual({
      status: 'OK',
      value: 240,
    });

    const margin = calculateContributionMargin(inputs, 'ACTUAL');
    if (margin.status === 'OK') expect(formatBps(margin.value)).toBe('20.00%');

    // 6.0 empty of 25.0 total.
    const emptyMileage = calculateEmptyMileage(inputs);
    if (emptyMileage.status === 'OK')
      expect(formatBps(emptyMileage.value)).toBe('24.00%');
  });
});

describe('12. An invoice becomes available', () => {
  let invoiceId: string;

  it('raises an invoice for the completed job', async () => {
    const client = await sessionClient(ronald.authUserId);

    const invoice = await client.query<{ id: string }>(
      `insert into invoices (invoice_number, customer_id, status, issue_date, due_date, created_by)
       values ('E2E-I-0001', $1, 'DRAFT', current_date, current_date + 30, $2) returning id`,
      [customerId, ronald.userId],
    );
    invoiceId = invoice.rows[0]!.id;

    await client.query(
      `insert into invoice_lines (invoice_id, job_id, sequence, description, unit_price_cents, total_cents)
       values ($1, $2, 1, 'Job E2E-J-0001', 30000, 30000)`,
      [invoiceId, jobId],
    );
    await client.end();

    const stored = await admin.query<{ total_cents: string }>(
      'select total_cents from invoices where id = $1',
      [invoiceId],
    );
    expect(Number(stored.rows[0]!.total_cents)).toBe(30000);
  });

  it('cannot be marked paid by hand', async () => {
    const client = await sessionClient(ronald.authUserId);
    await expect(
      client.query("update invoices set status = 'PAID' where id = $1", [invoiceId]),
    ).rejects.toThrow(/recorded payments cover its total/i);
    await client.end();
  });

  it('becomes PAID when the money arrives', async () => {
    const client = await sessionClient(ronald.authUserId);
    await client.query(
      `insert into payments (invoice_id, amount_cents, method, recorded_by)
       values ($1, 30000, 'BANK_TRANSFER', $2)`,
      [invoiceId, ronald.userId],
    );
    await client.end();

    const result = await admin.query<{ status: string }>(
      'select status from invoices where id = $1',
      [invoiceId],
    );
    expect(result.rows[0]!.status).toBe('PAID');
  });
});

describe('13. The audit trail recorded the whole journey', () => {
  it('recorded every status change in order', async () => {
    const result = await admin.query<{ new_value: string }>(
      `select new_value from audit_logs
       where entity_id = $1 and action = 'STATUS_CHANGED' order by id`,
      [jobId],
    );

    expect(result.rows.map((r) => r.new_value)).toEqual([
      'SCHEDULED',
      'ASSIGNED',
      'DRIVER_ACCEPTED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DELIVERY',
      'DELIVERED',
      'POD_RECEIVED',
      'COMPLETED',
    ]);
  });

  it('recorded who assigned the van and the driver', async () => {
    const result = await admin.query<{ user_id: string; action: string }>(
      `select user_id, action from audit_logs
       where entity_id = $1 and action in ('VEHICLE_ASSIGNMENT_CHANGED', 'DRIVER_ASSIGNMENT_CHANGED')`,
      [jobId],
    );

    expect(result.rowCount).toBe(2);
    expect(result.rows.every((r) => r.user_id === ronald.userId)).toBe(true);
  });

  it('recorded Moh’s field progress against Moh', async () => {
    const result = await admin.query<{ user_id: string }>(
      `select user_id from audit_logs
       where entity_id = $1 and action = 'STATUS_CHANGED' and new_value = 'PICKED_UP'`,
      [jobId],
    );
    expect(result.rows[0]!.user_id).toBe(moh.userId);
  });

  it('recorded the costs as they were entered', async () => {
    const result = await admin.query<{ field: string }>(
      `select field from audit_logs where entity_id = $1 and action = 'COST_RECORDED'`,
      [jobId],
    );

    const fields = result.rows.map((r) => r.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'fuel_cost_actual_cents',
        'driver_cost_actual_cents',
        'vehicle_cost_actual_cents',
      ]),
    );
  });
});
