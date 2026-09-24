import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { adminClient } from './helpers/db';

/**
 * Every SECURITY DEFINER function bypasses row level security, so the
 * same-company rule (0032) does not protect what it reads or writes. Each one
 * has been reviewed for how it stays within one company (Phase 2, M2).
 *
 * A new elevated-rights function fails this test until it is reviewed and
 * added here with the reason it cannot cross companies.
 */

const REVIEWED: Record<string, string> = {
  // Identity: each reads only the caller's own user row, by auth.uid().
  current_app_user_id: 'own row by auth.uid()',
  current_app_user_role: 'own row by auth.uid()',
  current_org_id: 'own row by auth.uid()',
  is_admin: 'own row by auth.uid()',
  is_driver: 'own row by auth.uid()',
  is_partner: 'own row by auth.uid()',
  record_my_sign_in: 'own row by auth.uid()',
  my_assigned_job_ids: "the caller's own assigned jobs",

  // Driver actions: only on a job assigned to the calling driver.
  driver_advance_job: 'refuses any job not in my_assigned_job_ids()',
  driver_record_mileage: 'refuses any job not in my_assigned_job_ids()',

  // Company assignment and numbering.
  assign_organisation:
    "sets the parent's or the caller's company; composite keys and the same-company rule check it",
  issue_reference_number:
    'counter row keyed by the company passed; executable by no api role',
  next_reference_number: "always the caller's own company",
  assign_incident_number: "the incident's own company",
  create_public_job_request:
    'files under the named, active company only; returns only the reference',
  storage_object_company:
    'reports the company of one record; policies compare it with the caller',

  // Notifications: only the partners of the row's own company (0031).
  notify_partners: 'filters recipients by the company passed; executable by no api role',
  notify_on_job_request: "passes the request's company",
  notify_on_job_milestone: "passes the job's company",
  notify_partners_of_incident: "passes the incident's company",

  // Dispatch: signed-in callers see only their own company (0032).
  find_dispatch_conflicts: 'restricted to current_org_id() for any signed-in caller',
  enforce_dispatch_rules: 'uses find_dispatch_conflicts on the row being written',

  // Triggers acting only on the row being written, or its own children and
  // parents — which composite keys hold in the same company.
  enforce_driver_job_update_columns: 'the row being written',
  enforce_driver_record_immutability: 'the row being written',
  enforce_driver_self_update_columns: 'the row being written',
  enforce_invoice_payment_truth: 'the row being written',
  enforce_job_status_transition: 'the row being written',
  enforce_pod_before_pod_received: "the job's own documents",
  enforce_user_management_rules:
    'last-admin check per company; a person cannot change company',
  enforce_vehicle_status_change: 'the row being written',
  fuel_transaction_to_expense: "writes the expense for the fuel row's own vehicle",
  maintenance_to_cost_entry: "writes the cost entry for the record's own vehicle",
  recalculate_invoice_payment: "the invoice's own payments",
  recalculate_invoice_total: "the invoice's own lines",
  rollup_job_expenses: "the job's own expenses",
  sync_customer_primary_contact: "the customer's own contacts",
  sync_resource_state_from_job: "the job's own vehicle and driver",
  write_audit_log: "records the row's own company",
};

let admin: Client;

beforeAll(async () => {
  admin = await adminClient();
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

describe('every elevated-rights function has been reviewed for company isolation', () => {
  it('matches the reviewed list exactly', async () => {
    const result = await admin.query<{ proname: string }>(
      `select distinct p.proname
         from pg_proc p
         left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
        where p.pronamespace = 'public'::regnamespace
          and p.prosecdef
          and d.objid is null
        order by 1`,
    );
    expect(result.rows.map((row) => row.proname)).toEqual(Object.keys(REVIEWED).sort());
  });
});
