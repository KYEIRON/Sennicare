/**
 * The BOYD'S pricing engine.
 *
 * Fully transparent: every output carries the breakdown that produced it, and
 * the breakdown is stored on the quote so a price given months ago can still be
 * explained line by line.
 *
 * Two rules govern this file:
 *
 *   1. Nothing is invented. Minimum contribution and target margin are open
 *      business decisions; where they are unset the engine returns
 *      NOT_CONFIGURED for the affected output and computes the rest. It does
 *      not substitute an industry default.
 *   2. A cost that cannot be estimated is MISSING, not zero. A price built on
 *      an unknown cost would look entirely reasonable and be wrong.
 */

import {
  cents,
  milesTenths,
  type Bps,
  type Cents,
  type MilesTenths,
  type MpgTenths,
} from '@/types/branded';
import {
  calcIncomplete,
  calcNotCalculable,
  calcNotConfigured,
  calcOk,
  combineCalculations,
  type Calculation,
} from '@/lib/calculation';
import { addCents, applyBps, centsPerMile, subtractCents } from '@/lib/money';
import { gallonsForDistance } from '@/lib/distance';
import { BUSINESS_SETTINGS } from '@/lib/configured';
import type { DriverLabourCostBasis, LabourCostTreatment } from '@/types/economics';

/** One line of the cost estimate, with where the figure came from. */
export interface CostLine {
  readonly label: string;
  readonly amount: Cents;
  readonly basis: string;
}

export interface PricingInputs {
  readonly miles: MilesTenths;
  /** Fuel price per gallon, as actually paid. Null if BOYD'S has no recent figure. */
  readonly fuelPricePerGallonCents: number | null;
  /** The vehicle's real economy. Null if not recorded. */
  readonly vehicleMpg: MpgTenths | null;
  /** Derived vehicle cost per mile. Null when it cannot be derived. */
  readonly vehicleCostPerMileCents: number | null;
  /** How driving labour is costed. NOT CONFIGURED until the partners decide. */
  readonly driverLabourBasis: DriverLabourCostBasis | null;
  readonly estimatedHours: number | null;
  readonly expectedTollsCents: number | null;
  readonly expectedParkingCents: number | null;
  readonly otherCostsCents: number | null;
  /** Basis points above 10000. 12500 means a 25% urgency uplift. */
  readonly urgencyMultiplierBps: number | null;
}

export interface PricingPolicy {
  readonly minimumContributionCents: number | null;
  readonly minimumContributionPerMileCents: number | null;
  readonly targetMarginBps: number | null;
}

export interface CostEstimate {
  readonly lines: readonly CostLine[];
  readonly total: Cents;
  readonly labourTreatment: LabourCostTreatment;
}

/**
 * Estimate what a job will cost BOYD'S.
 *
 * Every line names its basis, so a partner can see whether a figure came from a
 * real fuel price and a real MPG or from an assumption. Any input the engine
 * needs and does not have makes the whole estimate DATA_INCOMPLETE.
 */
export function estimateCost(inputs: PricingInputs): Calculation<CostEstimate> {
  const lines: CostLine[] = [];
  const missing: string[] = [];

  // Fuel: real price, real economy, real distance. No assumed MPG.
  if (inputs.fuelPricePerGallonCents === null) {
    missing.push('fuel_price_per_gallon');
  } else if (inputs.vehicleMpg === null) {
    missing.push('vehicle_fuel_economy');
  } else {
    const gallons = gallonsForDistance(inputs.miles, inputs.vehicleMpg);
    if (gallons.status !== 'OK') {
      missing.push('vehicle_fuel_economy');
    } else {
      lines.push({
        label: 'Fuel',
        amount: cents(
          Math.round((gallons.value / 1000) * inputs.fuelPricePerGallonCents),
        ),
        basis: `${(gallons.value / 1000).toFixed(2)} gal at ${(inputs.fuelPricePerGallonCents / 100).toFixed(2)}/gal`,
      });
    }
  }

  // Driving labour, on whichever basis the partners have chosen.
  const labour = estimateLabour(inputs);
  if (labour === 'NOT_CONFIGURED') {
    return calcNotConfigured<CostEstimate>(BUSINESS_SETTINGS.DRIVER_LABOUR_COST_BASIS);
  }
  if (labour === 'MISSING_HOURS') {
    missing.push('estimated_hours');
  } else if (labour !== null) {
    lines.push(labour);
  }

  // Vehicle running cost, from the derived rate. Never a typed-in figure.
  if (inputs.vehicleCostPerMileCents === null) {
    missing.push('vehicle_cost_per_mile');
  } else {
    lines.push({
      label: 'Vehicle',
      amount: cents(Math.round((inputs.vehicleCostPerMileCents * inputs.miles) / 10)),
      basis: `${(inputs.vehicleCostPerMileCents / 100).toFixed(2)}/mi derived from recorded vehicle costs`,
    });
  }

  // Tolls, parking and other costs. Zero is a legitimate estimate here — a
  // route with no tolls genuinely has none — so these do not block the estimate.
  for (const [label, value] of [
    ['Tolls', inputs.expectedTollsCents],
    ['Parking', inputs.expectedParkingCents],
    ['Other', inputs.otherCostsCents],
  ] as const) {
    if (value !== null && value > 0) {
      lines.push({ label, amount: cents(value), basis: 'Expected for this route' });
    }
  }

  if (missing.length > 0) {
    return calcIncomplete<CostEstimate>(missing);
  }

  const base = addCents(...lines.map((line) => line.amount));

  // Urgency raises the price, not the cost. It is applied at the price stage.
  return calcOk({
    lines,
    total: base,
    labourTreatment:
      inputs.driverLabourBasis?.kind === 'EXCLUDED_FROM_JOB_COST'
        ? 'BEFORE_LABOUR_COST'
        : 'LABOUR_COSTED',
  });
}

function estimateLabour(
  inputs: PricingInputs,
): CostLine | null | 'NOT_CONFIGURED' | 'MISSING_HOURS' {
  const basis = inputs.driverLabourBasis;
  if (basis === null) return 'NOT_CONFIGURED';

  switch (basis.kind) {
    case 'EXCLUDED_FROM_JOB_COST':
      // A legitimate management choice, and NOT the same as a zero cost — the
      // estimate is labelled BEFORE_LABOUR_COST so it cannot be mistaken for a
      // fully-costed one.
      return null;
    case 'PER_HOUR':
      if (inputs.estimatedHours === null) return 'MISSING_HOURS';
      return {
        label: 'Driver',
        amount: cents(Math.round(basis.rate * inputs.estimatedHours)),
        basis: `${inputs.estimatedHours}h at ${(basis.rate / 100).toFixed(2)}/h`,
      };
    case 'PER_MILE':
      return {
        label: 'Driver',
        amount: cents(Math.round((basis.rate * inputs.miles) / 10)),
        basis: `${(inputs.miles / 10).toFixed(1)} mi at ${(basis.rate / 100).toFixed(2)}/mi`,
      };
    case 'PER_JOB':
      return {
        label: 'Driver',
        amount: basis.rate,
        basis: 'Flat rate per job',
      };
  }
}

export interface PriceOption {
  readonly price: Cents;
  readonly contribution: Cents;
  readonly contributionPerMile: Calculation<Cents>;
}

export interface PricingResult {
  readonly estimate: CostEstimate;
  /** Cost plus the minimum acceptable contribution. NOT_CONFIGURED until set. */
  readonly minimumPrice: Calculation<Cents>;
  /** Cost grossed up to the target margin. NOT_CONFIGURED until set. */
  readonly targetPrice: Calculation<Cents>;
  readonly urgencyApplied: Bps | null;
}

/**
 * Price a job.
 *
 * Returns the cost estimate plus the two reference prices. Where a policy has
 * not been decided, that price reports NOT_CONFIGURED and names the setting —
 * the partner still sees the cost, and knows precisely which decision would let
 * the system recommend a price.
 */
export function priceJob(
  inputs: PricingInputs,
  policy: PricingPolicy,
): Calculation<PricingResult> {
  const estimate = estimateCost(inputs);
  if (estimate.status !== 'OK') return estimate as Calculation<PricingResult>;

  const uplift = inputs.urgencyMultiplierBps;
  const costWithUrgency =
    uplift === null || uplift === 10_000
      ? estimate.value.total
      : applyBps(estimate.value.total, uplift as Bps);

  const minimumPrice: Calculation<Cents> =
    policy.minimumContributionCents === null
      ? calcNotConfigured<Cents>(BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_JOB)
      : calcOk(addCents(costWithUrgency, cents(policy.minimumContributionCents)));

  const targetPrice: Calculation<Cents> = (() => {
    if (policy.targetMarginBps === null) {
      return calcNotConfigured<Cents>(BUSINESS_SETTINGS.TARGET_CONTRIBUTION_MARGIN);
    }
    if (policy.targetMarginBps >= 10_000) {
      return calcNotCalculable(
        'A target margin of 100% or more cannot be priced for: it would divide by zero.',
      );
    }
    return calcOk(
      cents(Math.round((costWithUrgency * 10_000) / (10_000 - policy.targetMarginBps))),
    );
  })();

  return calcOk({
    estimate: estimate.value,
    minimumPrice,
    targetPrice,
    urgencyApplied: uplift === null || uplift === 10_000 ? null : (uplift as Bps),
  });
}

/** What a given price would actually earn. */
export function evaluatePrice(
  price: Cents,
  estimate: CostEstimate,
  miles: MilesTenths,
): PriceOption {
  const contribution = subtractCents(price, estimate.total);
  return {
    price,
    contribution,
    contributionPerMile: centsPerMile(contribution, miles),
  };
}

export type FloorCheck =
  | { readonly status: 'MEETS_FLOOR' }
  | { readonly status: 'BELOW_FLOOR'; readonly reasons: readonly string[] }
  | { readonly status: 'NOT_CONFIGURED'; readonly settings: readonly string[] };

/**
 * Does this price clear BOYD'S floor?
 *
 * With no floor configured the answer is NOT_CONFIGURED, not "yes". The system
 * will not imply a price is acceptable against a standard that does not exist.
 */
export function checkAgainstFloor(
  option: PriceOption,
  policy: PricingPolicy,
): FloorCheck {
  const unset: string[] = [];
  if (policy.minimumContributionCents === null) {
    unset.push(BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_JOB);
  }
  if (policy.minimumContributionPerMileCents === null) {
    unset.push(BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_MILE);
  }

  if (unset.length === 2) {
    return { status: 'NOT_CONFIGURED', settings: unset };
  }

  const reasons: string[] = [];

  if (
    policy.minimumContributionCents !== null &&
    option.contribution < policy.minimumContributionCents
  ) {
    reasons.push(
      `Contribution is below the minimum of ${(policy.minimumContributionCents / 100).toFixed(2)}.`,
    );
  }

  if (
    policy.minimumContributionPerMileCents !== null &&
    option.contributionPerMile.status === 'OK' &&
    option.contributionPerMile.value < policy.minimumContributionPerMileCents
  ) {
    reasons.push(
      `Contribution per mile is below the minimum of ${(policy.minimumContributionPerMileCents / 100).toFixed(2)}.`,
    );
  }

  return reasons.length > 0
    ? { status: 'BELOW_FLOOR', reasons }
    : { status: 'MEETS_FLOOR' };
}

/** The stored, inspectable record of how a price was reached. */
export function buildBreakdown(
  inputs: PricingInputs,
  result: PricingResult,
  quotedPrice: Cents,
): Record<string, unknown> {
  const option = evaluatePrice(quotedPrice, result.estimate, inputs.miles);

  return {
    calculatedAt: new Date().toISOString(),
    miles: inputs.miles / 10,
    costLines: result.estimate.lines.map((line) => ({
      label: line.label,
      amountCents: line.amount,
      basis: line.basis,
    })),
    estimatedCostCents: result.estimate.total,
    labourTreatment: result.estimate.labourTreatment,
    urgencyAppliedBps: result.urgencyApplied,
    minimumPrice: result.minimumPrice,
    targetPrice: result.targetPrice,
    quotedPriceCents: quotedPrice,
    expectedContributionCents: option.contribution,
    expectedContributionPerMile: option.contributionPerMile,
  };
}

/** Total a set of quote lines. */
export function sumQuoteItems(
  items: readonly { unitPriceCents: number; quantity: number }[],
): Calculation<Cents> {
  const lines = items.map((item) =>
    calcOk(cents(Math.round(item.unitPriceCents * item.quantity))),
  );
  return combineCalculations(lines, (values) => addCents(...values));
}

/** A quote with no distance cannot be priced per mile. */
export function requireMiles(miles: number | null): Calculation<MilesTenths> {
  if (miles === null) return calcIncomplete<MilesTenths>(['estimated_miles']);
  if (miles <= 0) {
    return calcNotCalculable('A quote needs an estimated distance greater than zero.');
  }
  return calcOk(milesTenths(miles));
}
