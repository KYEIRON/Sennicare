/**
 * BOYD'S economic cost model — vocabulary only. No arithmetic lives here.
 *
 * This module exists to make two separations structural rather than a matter of
 * discipline, at Ronald's explicit instruction:
 *
 * 1. OPERATIONAL PROFITABILITY IS NOT PARTNER COMPENSATION.
 *    The system must be able to cost Moh's driving labour economically — what
 *    it would cost BOYD'S to have that driving done — for management
 *    profitability analysis, WITHOUT asserting anything about how Moh is
 *    legally paid as a partner. A partner drawing, a distribution, a guaranteed
 *    payment and a wage are accounting and legal treatments. They belong to a
 *    different ledger, and this codebase does not conflate the two.
 *
 * 2. VEHICLE COST PER MILE IS DERIVED, NOT DECLARED.
 *    A manually entered flat rate per mile is a guess wearing a number's
 *    clothing. The system tracks the underlying vehicle costs and derives cost
 *    per mile from them and from real recorded mileage.
 *
 * See docs/DECISIONS.md D-011 and D-012, and docs/FINANCIAL_ENGINE.md.
 */

import type { Cents } from './branded';

// ---------------------------------------------------------------------------
// 1. Driver labour — economic cost, deliberately separate from compensation
// ---------------------------------------------------------------------------

/**
 * How BOYD'S measures the ECONOMIC cost of driving labour on a job, for
 * management analysis. This is a costing question, not a payroll question.
 *
 * NOT CONFIGURED until the partners decide. Nothing here implies an employment
 * relationship, a wage, or any particular tax treatment.
 */
export type DriverLabourCostBasis =
  /** A notional hourly rate for time spent on the job. */
  | { readonly kind: 'PER_HOUR'; readonly rate: Cents }
  /** A notional rate per mile driven. */
  | { readonly kind: 'PER_MILE'; readonly rate: Cents }
  /** A flat notional amount per job. */
  | { readonly kind: 'PER_JOB'; readonly rate: Cents }
  /**
   * Driving labour is deliberately excluded from job cost.
   *
   * This is a legitimate management choice for an owner-operated business, and
   * it is NOT the same as the cost being zero. Contribution computed on this
   * basis is contribution BEFORE any charge for partner labour, and every
   * figure derived from it is labelled as such so it can never be mistaken for
   * a fully-costed result.
   */
  | { readonly kind: 'EXCLUDED_FROM_JOB_COST' };

/**
 * How a partner is actually compensated. Recorded for completeness and kept
 * strictly out of the operational profitability engine.
 *
 * The finance engine has no access to this type. It is here so that the
 * distinction is visible in the codebase, and so a future accounting module has
 * somewhere correct to put it.
 */
export type PartnerCompensationTreatment =
  | { readonly kind: 'NOT_CONFIGURED' }
  | { readonly kind: 'PARTNER_DRAW' }
  | { readonly kind: 'GUARANTEED_PAYMENT' }
  | { readonly kind: 'PROFIT_DISTRIBUTION' }
  | { readonly kind: 'WAGE' }
  | { readonly kind: 'OTHER'; readonly description: string };

/**
 * Whether a contribution figure has been charged for driving labour.
 *
 * Every contribution result carries this, so a figure computed with labour
 * excluded can never be presented as though labour had been paid for.
 */
export type LabourCostTreatment = 'LABOUR_COSTED' | 'BEFORE_LABOUR_COST';

// ---------------------------------------------------------------------------
// 2. Vehicle economics — derived from underlying costs, never declared
// ---------------------------------------------------------------------------

/** The underlying cost lines that can make up a vehicle's true cost per mile. */
export const VEHICLE_COST_LINES = [
  'FUEL',
  'INSURANCE',
  'FINANCE',
  'DEPRECIATION',
  'MAINTENANCE',
  'REPAIRS',
  'TYRES',
  'REGISTRATION',
  'OTHER_OPERATING',
] as const;

export type VehicleCostLine = (typeof VEHICLE_COST_LINES)[number];

/** The period a recorded vehicle cost covers. */
export type VehicleCostPeriod = 'MONTHLY' | 'ANNUAL' | 'PER_MILE' | 'ONE_OFF';

/**
 * One real, recorded vehicle cost. Every figure here is something BOYD'S
 * actually pays — no industry averages, no assumed depreciation curves.
 */
export interface VehicleCostEntry {
  readonly line: VehicleCostLine;
  readonly period: VehicleCostPeriod;
  readonly amount: Cents;
  /** Whether the partners include this line in true cost per mile. */
  readonly includedInCostPerMile: boolean;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
}

/**
 * How a derived vehicle cost is allocated to an individual job.
 *
 * The RATE is always derived from `VehicleCostEntry` rows and real mileage.
 * This setting chooses only how that derived rate is spread across jobs.
 */
export type VehicleAllocationBasis =
  | { readonly kind: 'PER_MILE' }
  | { readonly kind: 'PER_JOB' }
  | { readonly kind: 'PER_DAY' };

/**
 * The outcome of deriving true cost per mile, with its provenance attached.
 *
 * `linesIncluded` and `linesExcludedForMissingData` are what stop a partial
 * figure being read as a complete one: a cost per mile covering only fuel and
 * insurance is a real number, but it is not the vehicle's true cost per mile,
 * and the interface must say which lines it covers.
 */
export interface DerivedCostPerMile {
  readonly costPerMile: Cents;
  readonly linesIncluded: readonly VehicleCostLine[];
  readonly linesExcludedForMissingData: readonly VehicleCostLine[];
  readonly milesBasis: number;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}
