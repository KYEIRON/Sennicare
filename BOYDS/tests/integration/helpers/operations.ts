/**
 * Fixtures for the operational integration tests.
 *
 * Every value here is obviously synthetic and exists only inside the test
 * database. No real BOYD'S customer, vehicle specification, address, price or
 * driver detail is represented — see docs/DECISIONS.md D-014.
 */

import type { Client } from 'pg';

export async function seedCustomer(admin: Client, companyName: string): Promise<string> {
  const result = await admin.query<{ id: string }>(
    `insert into customers (customer_number, company_name, customer_type, customer_status)
     values ($1, $2, 'BUSINESS', 'ACTIVE') returning id`,
    [`TEST-C-${Math.random().toString(36).slice(2, 10)}`, companyName],
  );
  return result.rows[0]!.id;
}

export async function seedVehicle(
  admin: Client,
  code: string,
  overrides: { status?: string; active?: boolean } = {},
): Promise<string> {
  const result = await admin.query<{ id: string }>(
    `insert into vehicles (vehicle_code, status, active)
     values ($1, $2, $3) returning id`,
    [code, overrides.status ?? 'AVAILABLE', overrides.active ?? true],
  );
  return result.rows[0]!.id;
}

export async function jobTypeId(admin: Client, code = 'SAME_DAY'): Promise<string> {
  const result = await admin.query<{ id: string }>(
    'select id from job_types where code = $1',
    [code],
  );
  return result.rows[0]!.id;
}

export interface SeedJobOptions {
  customerId: string;
  jobTypeId: string;
  status?: string;
  vehicleId?: string | null;
  driverId?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  windowEnd?: string | null;
  wonPriceCents?: number | null;
}

let jobCounter = 0;

export async function seedJob(admin: Client, options: SeedJobOptions): Promise<string> {
  jobCounter += 1;
  const result = await admin.query<{ id: string }>(
    `insert into jobs (
       job_number, customer_id, job_type_id, status,
       vehicle_id, driver_id, scheduled_date, scheduled_time, scheduled_window_end,
       won_price_cents
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [
      `TEST-J-${jobCounter}-${Math.random().toString(36).slice(2, 6)}`,
      options.customerId,
      options.jobTypeId,
      options.status ?? 'REQUESTED',
      options.vehicleId ?? null,
      options.driverId ?? null,
      options.scheduledDate ?? null,
      options.scheduledTime ?? null,
      options.windowEnd ?? null,
      options.wonPriceCents ?? null,
    ],
  );
  return result.rows[0]!.id;
}

/**
 * Move a job through a sequence of statuses using the real triggers.
 *
 * Fixtures never bypass the state machine: a job reaches ASSIGNED by being
 * assigned, exactly as it would in the application.
 */
export async function advanceJob(
  admin: Client,
  jobId: string,
  statuses: readonly string[],
  extras: Record<string, unknown> = {},
): Promise<void> {
  for (const status of statuses) {
    const sets = ['status = $2'];
    const values: unknown[] = [jobId, status];

    for (const [column, value] of Object.entries(extras)) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }

    await admin.query(`update jobs set ${sets.join(', ')} where id = $1`, values);
  }
}
