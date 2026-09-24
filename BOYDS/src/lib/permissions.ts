/**
 * BOYD'S capability model.
 *
 * One table mapping role to capability. Adding a role, or changing what a role
 * may do, is an edit here rather than a search across the codebase — which is
 * what stops permission logic drifting apart in a dozen components.
 *
 * This is the SECOND of three enforcement layers. The first and authoritative
 * layer is Postgres row level security; the third is hiding controls a user
 * cannot use. Hidden UI is never an access control. See docs/SECURITY.md.
 */

import type { UserRole } from '@/types/auth';

export const CAPABILITIES = [
  // Operations
  'jobs.view.all',
  'jobs.view.assigned',
  'jobs.create',
  'jobs.assign',
  'jobs.advance_field_status',
  'customers.manage',
  'vehicles.manage',
  'vehicles.view.assigned',

  // Money — the driver boundary. No driver capability grants any of these.
  'financials.view',
  'pricing.manage',
  'quotes.manage',
  'invoices.manage',
  'reports.view',

  // Field recording
  'mileage.record',
  'fuel.record',
  'expenses.record',
  'documents.upload',

  // Administration
  'users.manage',
  'settings.manage',
  'audit.view',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * What a driver may do.
 *
 * Deliberately enumerated in full rather than derived by subtraction, so that
 * adding a new capability anywhere else in the system does NOT silently grant it
 * to drivers. A new capability is denied to drivers until someone adds it here
 * on purpose.
 */
const DRIVER_CAPABILITIES: readonly Capability[] = [
  'jobs.view.assigned',
  'jobs.advance_field_status',
  'vehicles.view.assigned',
  'mileage.record',
  'fuel.record',
  'expenses.record',
  'documents.upload',
];

/** What a partner may do: everything except system administration. */
const PARTNER_CAPABILITIES: readonly Capability[] = [
  'jobs.view.all',
  'jobs.create',
  'jobs.assign',
  'customers.manage',
  'vehicles.manage',
  'financials.view',
  'pricing.manage',
  'quotes.manage',
  'invoices.manage',
  'reports.view',
  'mileage.record',
  'fuel.record',
  'expenses.record',
  'documents.upload',
  'settings.manage',
  'audit.view',
];

const ROLE_CAPABILITIES: Readonly<Record<UserRole, readonly Capability[]>> = {
  DRIVER: DRIVER_CAPABILITIES,
  PARTNER: PARTNER_CAPABILITIES,
  ADMIN: CAPABILITIES,
};

export function capabilitiesFor(role: UserRole): readonly Capability[] {
  return ROLE_CAPABILITIES[role];
}

export function can(role: UserRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

/**
 * Capabilities that expose company financial information.
 *
 * Business rules 28 and 29: a driver must never reach a price, a cost, a
 * contribution, a margin, a customer list, an invoice, a quote, or a pricing
 * rule. A test asserts no driver capability appears in this list, so the driver
 * boundary cannot be widened by accident.
 */
export const FINANCIAL_CAPABILITIES: readonly Capability[] = [
  'financials.view',
  'pricing.manage',
  'quotes.manage',
  'invoices.manage',
  'reports.view',
  'customers.manage',
];

/** Where each role belongs after signing in. */
export function homeRouteFor(role: UserRole): string {
  return role === 'DRIVER' ? '/driver/today' : '/command-centre';
}
