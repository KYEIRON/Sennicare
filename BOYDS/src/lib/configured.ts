/**
 * Configured — a business policy that may not have been decided yet.
 *
 * BOYD'S has open business decisions (minimum contribution, target margin,
 * driver cost basis, vehicle allocation basis, payment terms). The instruction
 * from the partners is explicit: do not invent values. So an undecided policy is
 * a first-class state, not a null that some later `?? 0` can quietly turn into a
 * number.
 *
 * Anything reading a policy must handle NOT_CONFIGURED, and the interface shows
 * `NOT CONFIGURED` rather than a fabricated default.
 *
 * See docs/DECISIONS.md D-010.
 */

import { calcNotConfigured, type Calculation } from './calculation';

export type Configured<T> =
  | { readonly status: 'CONFIGURED'; readonly value: T; readonly setting: string }
  | { readonly status: 'NOT_CONFIGURED'; readonly setting: string };

export function configured<T>(setting: string, value: T): Configured<T> {
  return { status: 'CONFIGURED', value, setting };
}

export function notConfigured<T>(setting: string): Configured<T> {
  return { status: 'NOT_CONFIGURED', setting };
}

/**
 * Read a policy from a stored value that may be null.
 *
 * This is the ONLY sanctioned way to turn a nullable database column into a
 * business policy. There is deliberately no variant that accepts a fallback —
 * a fallback would be an invented business decision.
 */
export function fromNullable<T>(
  setting: string,
  value: T | null | undefined,
): Configured<T> {
  return value === null || value === undefined
    ? notConfigured<T>(setting)
    : configured(setting, value);
}

export function isConfigured<T>(
  c: Configured<T>,
): c is { status: 'CONFIGURED'; value: T; setting: string } {
  return c.status === 'CONFIGURED';
}

/** Lift a policy into a Calculation, so an undecided policy stops the sum. */
export function requireConfigured<T>(c: Configured<T>): Calculation<T> {
  return c.status === 'CONFIGURED'
    ? { status: 'OK', value: c.value }
    : calcNotConfigured<T>(c.setting);
}

/**
 * The open BOYD'S business decisions, as at 2026-08-24.
 *
 * Ronald has confirmed every one of these stays NOT CONFIGURED until the
 * partners decide. Each string is the `setting` a NOT_CONFIGURED result carries,
 * so the interface can name precisely what is undecided.
 */
export const BUSINESS_SETTINGS = {
  MINIMUM_CONTRIBUTION_PER_JOB: 'minimum_contribution_per_job',
  MINIMUM_CONTRIBUTION_PER_MILE: 'minimum_contribution_per_mile',
  TARGET_CONTRIBUTION_MARGIN: 'target_contribution_margin',
  DRIVER_LABOUR_COST_BASIS: 'driver_labour_cost_basis',
  VEHICLE_COST_ALLOCATION_BASIS: 'vehicle_cost_allocation_basis',
  SERVICE_AREA_RADIUS: 'service_area_radius',
  MEDICAL_COURIER_LIMITS: 'medical_courier_limits',
  DEFAULT_PAYMENT_TERMS: 'default_payment_terms',
  QUOTE_VALIDITY_PERIOD: 'quote_validity_period',
  AUTO_ACCEPTANCE_THRESHOLDS: 'auto_acceptance_thresholds',
} as const;

export type BusinessSetting = (typeof BUSINESS_SETTINGS)[keyof typeof BUSINESS_SETTINGS];
