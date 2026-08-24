/**
 * Operational repositories — the only place operational queries are written.
 *
 * Every query uses the caller's session-bound client, so row level security
 * applies to all of it. A mistake in this file cannot read past a policy.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { domainError, err, ok, type Result } from '@/lib/result';
import type {
  CustomerStatus,
  CustomerType,
  JobPriority,
  JobStatus,
  VehicleStatus,
  DriverAvailability,
  DriverStatus,
} from '@/types/operations';

function queryFailed(what: string) {
  return domainError('db/query-failed', `Could not load ${what}.`);
}

// --- Reference data ----------------------------------------------------------

export interface ReferenceRow {
  id: string;
  code: string;
  name: string;
}

export async function listJobTypes(
  client: SupabaseClient,
): Promise<Result<ReferenceRow[]>> {
  const { data, error } = await client
    .from('job_types')
    .select('id, code, name')
    .eq('active', true)
    .order('sort_order');

  return error ? err(queryFailed('job types')) : ok(data as ReferenceRow[]);
}

export async function listIndustries(
  client: SupabaseClient,
): Promise<Result<ReferenceRow[]>> {
  const { data, error } = await client
    .from('industries')
    .select('id, code, name')
    .eq('active', true)
    .order('sort_order');

  return error ? err(queryFailed('industries')) : ok(data as ReferenceRow[]);
}

// --- Customers ---------------------------------------------------------------

export interface CustomerSummary {
  id: string;
  customerNumber: string;
  companyName: string;
  customerType: CustomerType;
  customerStatus: CustomerStatus;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  lastActivityAt: string | null;
  provenance: 'REAL' | 'DEMO';
}

export async function listCustomers(
  client: SupabaseClient,
): Promise<Result<CustomerSummary[]>> {
  const { data, error } = await client
    .from('customers')
    .select(
      'id, customer_number, company_name, customer_type, customer_status, primary_contact_name, primary_contact_phone, last_activity_at, provenance',
    )
    .is('deleted_at', null)
    .order('company_name');

  if (error) return err(queryFailed('customers'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      customerNumber: row.customer_number,
      companyName: row.company_name,
      customerType: row.customer_type,
      customerStatus: row.customer_status,
      primaryContactName: row.primary_contact_name,
      primaryContactPhone: row.primary_contact_phone,
      lastActivityAt: row.last_activity_at,
      provenance: row.provenance,
    })),
  );
}

/**
 * Next customer number.
 *
 * Sequential and human-readable. Derived from the current count rather than a
 * database sequence so the numbering survives a restore without jumping.
 */
export async function nextCustomerNumber(client: SupabaseClient): Promise<string> {
  const { count } = await client
    .from('customers')
    .select('id', { count: 'exact', head: true });

  return `BC-${String((count ?? 0) + 1).padStart(4, '0')}`;
}

// --- Vehicles ----------------------------------------------------------------

export interface VehicleSummary {
  id: string;
  vehicleCode: string;
  status: VehicleStatus;
  make: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
  currentOdometerTenths: number | null;
  insuranceRenewalDate: string | null;
  active: boolean;
  provenance: 'REAL' | 'DEMO';
}

export async function listVehicles(
  client: SupabaseClient,
): Promise<Result<VehicleSummary[]>> {
  const { data, error } = await client
    .from('vehicles')
    .select(
      'id, vehicle_code, status, make, model, year, license_plate, current_odometer_tenths, insurance_renewal_date, active, provenance',
    )
    .order('vehicle_code');

  if (error) return err(queryFailed('vehicles'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      vehicleCode: row.vehicle_code,
      status: row.status,
      make: row.make,
      model: row.model,
      year: row.year,
      licensePlate: row.license_plate,
      currentOdometerTenths: row.current_odometer_tenths,
      insuranceRenewalDate: row.insurance_renewal_date,
      active: row.active,
      provenance: row.provenance,
    })),
  );
}

// --- Drivers -----------------------------------------------------------------

export interface DriverSummary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string | null;
  status: DriverStatus;
  availability: DriverAvailability;
  currentVehicleId: string | null;
  currentLocation: string | null;
  licenseExpiry: string | null;
  active: boolean;
}

export async function listDrivers(
  client: SupabaseClient,
): Promise<Result<DriverSummary[]>> {
  const { data, error } = await client
    .from('drivers')
    .select(
      'id, user_id, status, availability, current_vehicle_id, current_location, license_expiry, active, users!inner(first_name, last_name)',
    )
    .order('created_at');

  if (error) return err(queryFailed('drivers'));

  return ok(
    (data ?? []).map((row) => {
      const user = row.users as unknown as {
        first_name: string;
        last_name: string | null;
      };
      return {
        id: row.id,
        userId: row.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        status: row.status,
        availability: row.availability,
        currentVehicleId: row.current_vehicle_id,
        currentLocation: row.current_location,
        licenseExpiry: row.license_expiry,
        active: row.active,
      };
    }),
  );
}

// --- Jobs --------------------------------------------------------------------

/** Every column the profitability engine needs, plus the operational ones. */
export const JOB_COLUMNS = `
  id, job_number, status, priority, description,
  customer_id, job_type_id, vehicle_id, driver_id,
  scheduled_date, scheduled_time, scheduled_window_end,
  estimated_miles_tenths, actual_miles_tenths, loaded_miles_tenths, empty_miles_tenths,
  quoted_price_cents, won_price_cents,
  fuel_cost_estimated_cents, fuel_cost_actual_cents, fuel_cost_state,
  driver_cost_estimated_cents, driver_cost_actual_cents, driver_cost_state,
  vehicle_cost_estimated_cents, vehicle_cost_actual_cents, vehicle_cost_state,
  toll_cost_estimated_cents, toll_cost_actual_cents, toll_cost_state,
  parking_cost_estimated_cents, parking_cost_actual_cents, parking_cost_state,
  other_cost_estimated_cents, other_cost_actual_cents, other_cost_state,
  source, is_after_hours, requires_review, provenance,
  created_at, updated_at
`;

export interface JobRow {
  id: string;
  job_number: string;
  status: JobStatus;
  priority: JobPriority;
  description: string | null;
  customer_id: string;
  job_type_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_window_end: string | null;
  estimated_miles_tenths: number | null;
  actual_miles_tenths: number | null;
  loaded_miles_tenths: number | null;
  empty_miles_tenths: number | null;
  quoted_price_cents: number | null;
  won_price_cents: number | null;
  fuel_cost_estimated_cents: number | null;
  fuel_cost_actual_cents: number | null;
  driver_cost_estimated_cents: number | null;
  driver_cost_actual_cents: number | null;
  vehicle_cost_estimated_cents: number | null;
  vehicle_cost_actual_cents: number | null;
  toll_cost_estimated_cents: number | null;
  toll_cost_actual_cents: number | null;
  parking_cost_estimated_cents: number | null;
  parking_cost_actual_cents: number | null;
  other_cost_estimated_cents: number | null;
  other_cost_actual_cents: number | null;
  source: string;
  is_after_hours: boolean;
  requires_review: boolean;
  provenance: 'REAL' | 'DEMO';
  created_at: string;
  updated_at: string;
}

export async function listJobs(
  client: SupabaseClient,
  options: { statuses?: readonly JobStatus[]; scheduledDate?: string } = {},
): Promise<Result<JobRow[]>> {
  let query = client.from('jobs').select(JOB_COLUMNS);

  if (options.statuses?.length) query = query.in('status', options.statuses);
  if (options.scheduledDate) query = query.eq('scheduled_date', options.scheduledDate);

  const { data, error } = await query
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('scheduled_time', { ascending: true, nullsFirst: false });

  return error ? err(queryFailed('jobs')) : ok((data ?? []) as unknown as JobRow[]);
}

/** Jobs awaiting a vehicle or a driver — the dispatch queue. */
export async function listUnassignedJobs(
  client: SupabaseClient,
): Promise<Result<JobRow[]>> {
  const { data, error } = await client
    .from('jobs')
    .select(JOB_COLUMNS)
    .in('status', ['APPROVED', 'SCHEDULED'])
    .order('scheduled_date', { ascending: true, nullsFirst: false });

  return error
    ? err(queryFailed('unassigned jobs'))
    : ok((data ?? []) as unknown as JobRow[]);
}

export async function nextJobNumber(client: SupabaseClient): Promise<string> {
  const { count } = await client
    .from('jobs')
    .select('id', { count: 'exact', head: true });
  const year = new Date().getFullYear();
  return `BJ-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
}

// --- The driver's own jobs ---------------------------------------------------

export interface DriverJobRow {
  id: string;
  job_number: string;
  status: JobStatus;
  priority: JobPriority;
  description: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_window_end: string | null;
  customer_company_name: string;
  job_type_name: string;
  vehicle_code: string | null;
  special_handling: string | null;
  actual_miles_tenths: number | null;
}

/**
 * Read a driver's jobs through the view that has no financial columns in it.
 *
 * The driver application never queries `jobs` directly — this is the structural
 * half of the driver boundary.
 */
export async function listDriverJobs(
  client: SupabaseClient,
  scheduledDate?: string,
): Promise<Result<DriverJobRow[]>> {
  let query = client
    .from('driver_jobs')
    .select(
      'id, job_number, status, priority, description, scheduled_date, scheduled_time, scheduled_window_end, customer_company_name, job_type_name, vehicle_code, special_handling, actual_miles_tenths',
    );

  if (scheduledDate) query = query.eq('scheduled_date', scheduledDate);

  const { data, error } = await query.order('scheduled_time', {
    ascending: true,
    nullsFirst: false,
  });

  return error
    ? err(queryFailed('your jobs'))
    : ok((data ?? []) as unknown as DriverJobRow[]);
}
