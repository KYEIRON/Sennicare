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
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
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

// --- Profitability -----------------------------------------------------------

/** Job columns the profitability engine needs, plus the grouping keys. */
const PROFITABILITY_COLUMNS = `${JOB_COLUMNS}, completed_at`;

export interface ProfitabilityJobRow extends JobRow {
  completed_at: string | null;
}

export async function listJobsForProfitability(
  client: SupabaseClient,
  options: { from?: string; to?: string } = {},
): Promise<Result<ProfitabilityJobRow[]>> {
  let query = client.from('jobs').select(PROFITABILITY_COLUMNS);

  if (options.from) query = query.gte('completed_at', options.from);
  if (options.to) query = query.lt('completed_at', options.to);

  const { data, error } = await query.order('completed_at', {
    ascending: false,
    nullsFirst: false,
  });

  return error
    ? err(queryFailed('profitability data'))
    : ok((data ?? []) as unknown as ProfitabilityJobRow[]);
}

// --- Vehicle cost model ------------------------------------------------------

export interface VehicleCostEntry {
  id: string;
  vehicleId: string;
  costLine: string;
  period: string;
  amountCents: number;
  includedInCostPerMile: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export async function listVehicleCostEntries(
  client: SupabaseClient,
  vehicleId?: string,
): Promise<Result<VehicleCostEntry[]>> {
  let query = client
    .from('vehicle_cost_entries')
    .select(
      'id, vehicle_id, cost_line, period, amount_cents, included_in_cost_per_mile, effective_from, effective_to, notes',
    );

  if (vehicleId) query = query.eq('vehicle_id', vehicleId);

  const { data, error } = await query.order('effective_from', { ascending: false });

  if (error) return err(queryFailed('vehicle costs'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      costLine: row.cost_line,
      period: row.period,
      amountCents: row.amount_cents,
      includedInCostPerMile: row.included_in_cost_per_mile,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      notes: row.notes,
    })),
  );
}

/** Real miles a vehicle covered in a window, from completed jobs. */
export async function vehicleMilesInWindow(
  client: SupabaseClient,
  vehicleId: string,
  from: string,
  to: string,
): Promise<number> {
  const { data } = await client
    .from('jobs')
    .select('actual_miles_tenths')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'COMPLETED')
    .gte('completed_at', from)
    .lt('completed_at', to);

  return (data ?? []).reduce<number>(
    (sum, row) => sum + (row.actual_miles_tenths ?? 0),
    0,
  );
}

// --- Maintenance -------------------------------------------------------------

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  maintenanceType: string;
  description: string | null;
  dueDate: string | null;
  dueOdometerTenths: number | null;
  completedDate: string | null;
  costCents: number | null;
}

export async function listMaintenance(
  client: SupabaseClient,
  options: { outstandingOnly?: boolean } = {},
): Promise<Result<MaintenanceRecord[]>> {
  let query = client
    .from('maintenance_records')
    .select(
      'id, vehicle_id, maintenance_type, description, due_date, due_odometer_tenths, completed_date, cost_cents',
    );

  if (options.outstandingOnly) query = query.is('completed_date', null);

  const { data, error } = await query.order('due_date', {
    ascending: true,
    nullsFirst: false,
  });

  if (error) return err(queryFailed('maintenance'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      maintenanceType: row.maintenance_type,
      description: row.description,
      dueDate: row.due_date,
      dueOdometerTenths: row.due_odometer_tenths,
      completedDate: row.completed_date,
      costCents: row.cost_cents,
    })),
  );
}

// --- CRM ---------------------------------------------------------------------

export interface LeadRow {
  id: string;
  leadNumber: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: string;
  source: string;
  serviceInterest: string | null;
  estimatedValueCents: number | null;
  nextFollowupAt: string | null;
  isRecurringOpportunity: boolean;
  customerId: string | null;
  lostReason: string | null;
  provenance: 'REAL' | 'DEMO';
}

const LEAD_COLUMNS =
  'id, lead_number, company_name, contact_name, contact_email, contact_phone, stage, source, service_interest, estimated_value_cents, next_followup_at, is_recurring_opportunity, customer_id, lost_reason, provenance';

export async function listLeads(client: SupabaseClient): Promise<Result<LeadRow[]>> {
  const { data, error } = await client
    .from('leads')
    .select(LEAD_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) return err(queryFailed('leads'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      leadNumber: row.lead_number,
      companyName: row.company_name,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      stage: row.stage,
      source: row.source,
      serviceInterest: row.service_interest,
      estimatedValueCents: row.estimated_value_cents,
      nextFollowupAt: row.next_followup_at,
      isRecurringOpportunity: row.is_recurring_opportunity,
      customerId: row.customer_id,
      lostReason: row.lost_reason,
      provenance: row.provenance,
    })),
  );
}

export async function nextLeadNumber(client: SupabaseClient): Promise<string> {
  const { count } = await client
    .from('leads')
    .select('id', { count: 'exact', head: true });
  return `BL-${String((count ?? 0) + 1).padStart(4, '0')}`;
}

// --- Quotes ------------------------------------------------------------------

export interface QuoteRow {
  id: string;
  quoteNumber: string;
  customerId: string | null;
  jobTypeId: string;
  status: string;
  collectionSummary: string | null;
  deliverySummary: string | null;
  requestedDate: string | null;
  estimatedMilesTenths: number | null;
  estimatedCostCents: number | null;
  quotedPriceCents: number;
  expectedContributionCents: number | null;
  expectedContributionPerMileCents: number | null;
  belowMinimumOverride: boolean;
  validUntil: string | null;
  jobId: string | null;
  provenance: 'REAL' | 'DEMO';
  pricingBreakdown: Record<string, unknown>;
}

const QUOTE_COLUMNS =
  'id, quote_number, customer_id, job_type_id, status, collection_summary, delivery_summary, requested_date, estimated_miles_tenths, estimated_cost_cents, quoted_price_cents, expected_contribution_cents, expected_contribution_per_mile_cents, below_minimum_override, valid_until, job_id, provenance, pricing_breakdown';

export async function listQuotes(client: SupabaseClient): Promise<Result<QuoteRow[]>> {
  const { data, error } = await client
    .from('quotes')
    .select(QUOTE_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) return err(queryFailed('quotes'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      quoteNumber: row.quote_number,
      customerId: row.customer_id,
      jobTypeId: row.job_type_id,
      status: row.status,
      collectionSummary: row.collection_summary,
      deliverySummary: row.delivery_summary,
      requestedDate: row.requested_date,
      estimatedMilesTenths: row.estimated_miles_tenths,
      estimatedCostCents: row.estimated_cost_cents,
      quotedPriceCents: row.quoted_price_cents,
      expectedContributionCents: row.expected_contribution_cents,
      expectedContributionPerMileCents: row.expected_contribution_per_mile_cents,
      belowMinimumOverride: row.below_minimum_override,
      validUntil: row.valid_until,
      jobId: row.job_id,
      provenance: row.provenance,
      pricingBreakdown: row.pricing_breakdown ?? {},
    })),
  );
}

export async function nextQuoteNumber(client: SupabaseClient): Promise<string> {
  const { count } = await client
    .from('quotes')
    .select('id', { count: 'exact', head: true });
  const year = new Date().getFullYear();
  return `BQ-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
}

// --- Pricing policy ----------------------------------------------------------

export interface PricingPolicyRow {
  minimumContributionCents: number | null;
  minimumContributionPerMileCents: number | null;
  targetMarginBps: number | null;
  perMileCents: number | null;
  basePriceCents: number | null;
  urgencyMultiplierBps: number | null;
}

/**
 * The pricing policy in force for a job type.
 *
 * Returns nulls throughout when no rule exists — which is BOYD'S current state.
 * The engine reports NOT CONFIGURED from those nulls rather than inventing a
 * floor, so an absent rule can never quietly become a policy.
 */
export async function pricingPolicyFor(
  client: SupabaseClient,
  jobTypeId: string,
  priority: string,
): Promise<PricingPolicyRow> {
  const { data } = await client
    .from('pricing_rules')
    .select(
      'base_price_cents, per_mile_cents, minimum_price_cents, urgency_multiplier_bps, target_margin_bps, minimum_contribution_cents, minimum_contribution_per_mile_cents, job_type_id, priority_level',
    )
    .eq('active', true)
    .or(`job_type_id.eq.${jobTypeId},job_type_id.is.null`)
    .order('job_type_id', { ascending: false, nullsFirst: false });

  // Prefer the most specific rule: job type and priority, then job type, then
  // the general rule.
  const rules = data ?? [];
  const rule =
    rules.find((r) => r.job_type_id === jobTypeId && r.priority_level === priority) ??
    rules.find((r) => r.job_type_id === jobTypeId && r.priority_level === null) ??
    rules.find((r) => r.job_type_id === null);

  return {
    minimumContributionCents: rule?.minimum_contribution_cents ?? null,
    minimumContributionPerMileCents: rule?.minimum_contribution_per_mile_cents ?? null,
    targetMarginBps: rule?.target_margin_bps ?? null,
    perMileCents: rule?.per_mile_cents ?? null,
    basePriceCents: rule?.base_price_cents ?? null,
    urgencyMultiplierBps: rule?.urgency_multiplier_bps ?? null,
  };
}

// --- Invoices ----------------------------------------------------------------

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  totalCents: number;
  amountPaidCents: number;
  provenance: 'REAL' | 'DEMO';
}

export async function listInvoices(
  client: SupabaseClient,
): Promise<Result<InvoiceRow[]>> {
  const { data, error } = await client
    .from('invoices')
    .select(
      'id, invoice_number, customer_id, status, issue_date, due_date, total_cents, amount_paid_cents, provenance',
    )
    .order('issue_date', { ascending: false, nullsFirst: false });

  if (error) return err(queryFailed('invoices'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      status: row.status,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      totalCents: row.total_cents,
      amountPaidCents: row.amount_paid_cents,
      provenance: row.provenance,
    })),
  );
}

export async function nextInvoiceNumber(client: SupabaseClient): Promise<string> {
  const { count } = await client
    .from('invoices')
    .select('id', { count: 'exact', head: true });
  const year = new Date().getFullYear();
  return `BI-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
}

/**
 * Completed jobs with an agreed price that are not yet on an invoice.
 *
 * This is what BOYD'S has earned and not yet billed for — usually the largest
 * single thing a small business is losing track of.
 */
export async function listUninvoicedJobs(
  client: SupabaseClient,
): Promise<
  Result<{ id: string; jobNumber: string; customerId: string; wonPriceCents: number }[]>
> {
  const [{ data: jobs, error }, { data: lines }] = await Promise.all([
    client
      .from('jobs')
      .select('id, job_number, customer_id, won_price_cents')
      .eq('status', 'COMPLETED')
      .not('won_price_cents', 'is', null),
    client.from('invoice_lines').select('job_id'),
  ]);

  if (error) return err(queryFailed('uninvoiced jobs'));

  const invoiced = new Set((lines ?? []).map((line) => line.job_id));

  return ok(
    (jobs ?? [])
      .filter((job) => !invoiced.has(job.id))
      .map((job) => ({
        id: job.id,
        jobNumber: job.job_number,
        customerId: job.customer_id,
        wonPriceCents: job.won_price_cents as number,
      })),
  );
}

export interface ContractRow {
  id: string;
  contractNumber: string;
  customerId: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  frequency: string | null;
  agreedRateCents: number | null;
}

export async function listContracts(
  client: SupabaseClient,
): Promise<Result<ContractRow[]>> {
  const { data, error } = await client
    .from('contracts')
    .select(
      'id, contract_number, customer_id, title, status, start_date, end_date, frequency, agreed_rate_cents',
    )
    .order('created_at', { ascending: false });

  if (error) return err(queryFailed('contracts'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      contractNumber: row.contract_number,
      customerId: row.customer_id,
      title: row.title,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      frequency: row.frequency,
      agreedRateCents: row.agreed_rate_cents,
    })),
  );
}

// --- Notifications -----------------------------------------------------------

export interface NotificationRow {
  id: string;
  notificationType: string;
  severity: 'INFO' | 'ATTENTION' | 'URGENT';
  title: string;
  body: string | null;
  entityTable: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(
  client: SupabaseClient,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Result<NotificationRow[]>> {
  let query = client
    .from('notifications')
    .select(
      'id, notification_type, severity, title, body, entity_table, entity_id, read_at, created_at',
    );

  if (options.unreadOnly) query = query.is('read_at', null);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (error) return err(queryFailed('notifications'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      notificationType: row.notification_type,
      severity: row.severity,
      title: row.title,
      body: row.body,
      entityTable: row.entity_table,
      entityId: row.entity_id,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
  );
}

/** Requests that have arrived and not yet been reviewed. */
export interface JobRequestRow {
  id: string;
  requestNumber: string;
  status: string;
  source: string;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  pickupAddress: string | null;
  pickupCity: string | null;
  pickupState: string | null;
  pickupZip: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryZip: string | null;
  description: string | null;
  urgency: string | null;
  isRecurring: boolean | null;
  isAfterHours: boolean;
  receivedAt: string;
}

export async function listJobRequests(
  client: SupabaseClient,
  options: { newOnly?: boolean } = {},
): Promise<Result<JobRequestRow[]>> {
  let query = client
    .from('job_requests')
    .select(
      'id, request_number, status, source, company_name, contact_name, contact_email, contact_phone, pickup_address, pickup_city, pickup_state, pickup_zip, delivery_address, delivery_city, delivery_state, delivery_zip, description, urgency, is_recurring, is_after_hours, received_at',
    );

  if (options.newOnly) query = query.eq('status', 'NEW');

  const { data, error } = await query.order('received_at', { ascending: false });

  if (error) return err(queryFailed('requests'));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      requestNumber: row.request_number,
      status: row.status,
      source: row.source,
      companyName: row.company_name,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      pickupAddress: row.pickup_address,
      pickupCity: row.pickup_city,
      pickupState: row.pickup_state,
      pickupZip: row.pickup_zip,
      deliveryAddress: row.delivery_address,
      deliveryCity: row.delivery_city,
      deliveryState: row.delivery_state,
      deliveryZip: row.delivery_zip,
      description: row.description,
      urgency: row.urgency,
      isRecurring: row.is_recurring,
      isAfterHours: row.is_after_hours,
      receivedAt: row.received_at,
    })),
  );
}

// --- Incidents ---------------------------------------------------------------

export interface IncidentRow {
  id: string;
  incidentNumber: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurredAt: string;
  locationDescription: string | null;
  description: string;
  anyoneInjured: boolean;
  policeInvolved: boolean;
  policeReportNumber: string | null;
  thirdPartyInvolved: boolean;
  thirdPartyDetails: string | null;
  goodsAffected: boolean;
  /** Null means the cost is not yet known. It never means zero. */
  costCents: string | number | null;
  resolutionNotes: string | null;
  jobId: string | null;
  jobNumber: string | null;
  driverName: string | null;
  vehicleCode: string | null;
}

export async function listIncidents(
  client: SupabaseClient,
  options: { openOnly?: boolean } = {},
): Promise<Result<IncidentRow[]>> {
  let query = client
    .from('incidents')
    .select(
      'id, incident_number, incident_type, severity, status, occurred_at, location_description, description, anyone_injured, police_involved, police_report_number, third_party_involved, third_party_details, goods_affected, cost_cents, resolution_notes, job_id, jobs(job_number), vehicles(vehicle_code), drivers(users(first_name, last_name))',
    );

  if (options.openOnly) query = query.in('status', ['REPORTED', 'UNDER_REVIEW']);

  const { data, error } = await query.order('occurred_at', { ascending: false });

  if (error) return err(queryFailed('incidents'));

  return ok(
    (data ?? []).map((row) => {
      const job = firstOrOne<{ job_number: string }>(row.jobs);
      const vehicle = firstOrOne<{ vehicle_code: string }>(row.vehicles);
      const driver = firstOrOne<{
        users: unknown;
      }>(row.drivers);
      const user = driver
        ? firstOrOne<{ first_name: string; last_name: string | null }>(driver.users)
        : null;

      return {
        id: row.id,
        incidentNumber: row.incident_number,
        incidentType: row.incident_type,
        severity: row.severity,
        status: row.status,
        occurredAt: row.occurred_at,
        locationDescription: row.location_description,
        description: row.description,
        anyoneInjured: row.anyone_injured,
        policeInvolved: row.police_involved,
        policeReportNumber: row.police_report_number,
        thirdPartyInvolved: row.third_party_involved,
        thirdPartyDetails: row.third_party_details,
        goodsAffected: row.goods_affected,
        costCents: row.cost_cents,
        resolutionNotes: row.resolution_notes,
        jobId: row.job_id,
        jobNumber: job?.job_number ?? null,
        driverName: user
          ? [user.first_name, user.last_name].filter(Boolean).join(' ')
          : null,
        vehicleCode: vehicle?.vehicle_code ?? null,
      };
    }),
  );
}

/**
 * PostgREST returns an embedded relation as an object or an array depending on
 * the shape of the join. Normalise rather than assume.
 */
function firstOrOne<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return (value as T | null) ?? null;
}
