/**
 * Job cost assembly and contribution — the profitability foundation.
 *
 * The rules this file exists to enforce:
 *
 *   1. A MISSING cost is not zero. Treating it as zero would overstate
 *      contribution, which is the precise failure BOYD'S exists to avoid.
 *   2. An estimate never silently becomes an actual. The two are stored
 *      separately and the basis is chosen explicitly by the caller.
 *   3. No definitive profitability result is shown when required data is
 *      missing — the answer is DATA INCOMPLETE, naming what is absent.
 *   4. Driver labour cost is an ECONOMIC measure for management analysis. It
 *      says nothing about how a partner is legally compensated, and a
 *      contribution computed without it is labelled BEFORE_LABOUR_COST so it
 *      can never be mistaken for a fully-costed figure.
 */

import {
  cents,
  milesTenths,
  type Bps,
  type Cents,
  type MilesTenths,
} from '@/types/branded';
import {
  calcIncomplete,
  calcNotCalculable,
  calcOk,
  combineCalculations,
  type Calculation,
} from '@/lib/calculation';
import { addCents, centsPerMile, ratioBps, subtractCents } from '@/lib/money';
import { emptyMileageBps } from '@/lib/distance';
import type { CostState } from '@/types/operations';
import type { LabourCostTreatment } from '@/types/economics';

/** One cost line as stored on a job: both figures, plus the derived state. */
export interface JobCostLine {
  readonly estimated: Cents | null;
  readonly actual: Cents | null;
  readonly state: CostState;
}

export const JOB_COST_FIELDS = [
  'fuel_cost',
  'driver_cost',
  'vehicle_cost',
  'toll_cost',
  'parking_cost',
  'other_cost',
] as const;

export type JobCostField = (typeof JOB_COST_FIELDS)[number];

export interface JobCostInputs {
  readonly revenue: Cents | null;
  readonly costs: Readonly<Record<JobCostField, JobCostLine>>;
  readonly actualMiles: MilesTenths | null;
  readonly loadedMiles: MilesTenths | null;
  readonly emptyMiles: MilesTenths | null;
}

/**
 * Which figures a calculation is permitted to use.
 *
 * ACTUAL is the basis for anything a partner will make a decision on:
 * reporting, invoicing, customer profitability. BEST_AVAILABLE is for planning
 * and quoting, and every result it produces is tagged with the estimates it
 * leaned on.
 */
export type CostBasis = 'ACTUAL' | 'BEST_AVAILABLE';

/** Read one cost line on the chosen basis. */
export function readCostLine(
  field: JobCostField,
  line: JobCostLine,
  basis: CostBasis,
): Calculation<Cents> {
  if (line.state === 'MISSING') {
    return calcIncomplete<Cents>([field]);
  }

  if (line.actual !== null) {
    return calcOk(line.actual);
  }

  // Only an estimate exists.
  if (basis === 'ACTUAL') {
    return calcIncomplete<Cents>([`${field} (actual)`]);
  }

  return calcOk(line.estimated!, [field]);
}

/**
 * Total cost.
 *
 * `excludeDriverLabour` supports the case where the partners choose not to
 * charge driving labour to jobs. That is a legitimate management choice for an
 * owner-operated business — and it is NOT the same as the cost being zero, which
 * is why the result carries a labour treatment.
 */
export interface TotalCostResult {
  readonly total: Cents;
  readonly labourTreatment: LabourCostTreatment;
}

export function calculateTotalCost(
  inputs: JobCostInputs,
  basis: CostBasis,
  options: { readonly excludeDriverLabour?: boolean } = {},
): Calculation<TotalCostResult> {
  const excludeLabour = options.excludeDriverLabour === true;
  const fields = excludeLabour
    ? JOB_COST_FIELDS.filter((f) => f !== 'driver_cost')
    : JOB_COST_FIELDS;

  const lines = fields.map((field) => readCostLine(field, inputs.costs[field], basis));

  return combineCalculations(lines, (values) => ({
    total: addCents(...values),
    labourTreatment: excludeLabour
      ? ('BEFORE_LABOUR_COST' as const)
      : ('LABOUR_COSTED' as const),
  }));
}

export interface ContributionResult {
  readonly revenue: Cents;
  readonly totalCost: Cents;
  readonly contribution: Cents;
  readonly labourTreatment: LabourCostTreatment;
}

/**
 * Contribution: revenue minus every cost.
 *
 * Returns DATA_INCOMPLETE — never a number — when any cost is missing, and
 * NOT_CALCULABLE when there is no revenue figure at all. It never floors a loss
 * at zero: a job that lost money reports a negative contribution.
 */
export function calculateContribution(
  inputs: JobCostInputs,
  basis: CostBasis,
  options: { readonly excludeDriverLabour?: boolean } = {},
): Calculation<ContributionResult> {
  if (inputs.revenue === null) {
    return calcIncomplete<ContributionResult>(['won_price']);
  }

  const revenue = inputs.revenue;
  const costResult = calculateTotalCost(inputs, basis, options);

  if (costResult.status !== 'OK') {
    return costResult as Calculation<ContributionResult>;
  }

  return calcOk(
    {
      revenue,
      totalCost: costResult.value.total,
      contribution: subtractCents(revenue, costResult.value.total),
      labourTreatment: costResult.value.labourTreatment,
    },
    costResult.usedEstimates,
  );
}

/** Contribution per mile. Zero miles yields NOT_CALCULABLE, never a number. */
export function calculateContributionPerMile(
  inputs: JobCostInputs,
  basis: CostBasis,
  options: { readonly excludeDriverLabour?: boolean } = {},
): Calculation<Cents> {
  if (inputs.actualMiles === null) {
    return calcIncomplete<Cents>(['actual_miles']);
  }

  const contribution = calculateContribution(inputs, basis, options);
  if (contribution.status !== 'OK') {
    return contribution as Calculation<Cents>;
  }

  const perMile = centsPerMile(contribution.value.contribution, inputs.actualMiles);
  return perMile.status === 'OK'
    ? calcOk(perMile.value, contribution.usedEstimates)
    : perMile;
}

/** Contribution margin in basis points. */
export function calculateContributionMargin(
  inputs: JobCostInputs,
  basis: CostBasis,
  options: { readonly excludeDriverLabour?: boolean } = {},
): Calculation<Bps> {
  const contribution = calculateContribution(inputs, basis, options);
  if (contribution.status !== 'OK') {
    return contribution as Calculation<Bps>;
  }

  const margin = ratioBps(contribution.value.contribution, contribution.value.revenue);
  return margin.status === 'OK'
    ? calcOk(margin.value, contribution.usedEstimates)
    : margin;
}

/** Empty mileage as a proportion of the job's total miles. */
export function calculateEmptyMileage(inputs: JobCostInputs): Calculation<Bps> {
  if (inputs.emptyMiles === null || inputs.actualMiles === null) {
    const missing: string[] = [];
    if (inputs.emptyMiles === null) missing.push('empty_miles');
    if (inputs.actualMiles === null) missing.push('actual_miles');
    return calcIncomplete<Bps>(missing);
  }
  return emptyMileageBps(inputs.emptyMiles, inputs.actualMiles);
}

/**
 * Check the loaded/empty split accounts for the total.
 *
 * Business rule 21. A log that breaks this is rejected rather than being
 * quietly absorbed into one bucket, because empty mileage is a metric BOYD'S
 * makes decisions on.
 */
export function validateMileageSplit(
  loaded: MilesTenths | null,
  empty: MilesTenths | null,
  total: MilesTenths | null,
): Calculation<MilesTenths> {
  if (loaded === null || empty === null || total === null) {
    const missing: string[] = [];
    if (loaded === null) missing.push('loaded_miles');
    if (empty === null) missing.push('empty_miles');
    if (total === null) missing.push('actual_miles');
    return calcIncomplete<MilesTenths>(missing);
  }

  if (loaded + empty !== total) {
    return calcNotCalculable(
      `Loaded (${loaded / 10}) plus empty (${empty / 10}) does not equal total (${total / 10}) miles.`,
    );
  }

  return calcOk(total);
}

/** An empty cost line — a cost BOYD'S has not recorded. */
export function missingCost(): JobCostLine {
  return { estimated: null, actual: null, state: 'MISSING' };
}

/** Build a cost line from stored values, deriving the state exactly as the database does. */
export function costLine(estimated: number | null, actual: number | null): JobCostLine {
  return {
    estimated: estimated === null ? null : cents(estimated),
    actual: actual === null ? null : cents(actual),
    state: actual !== null ? 'ACTUAL' : estimated !== null ? 'ESTIMATED' : 'MISSING',
  };
}

/** Assemble cost inputs from a stored job row. */
export function costInputsFromRow(row: {
  won_price_cents: number | null;
  actual_miles_tenths: number | null;
  loaded_miles_tenths: number | null;
  empty_miles_tenths: number | null;
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
}): JobCostInputs {
  return {
    revenue: row.won_price_cents === null ? null : cents(row.won_price_cents),
    actualMiles:
      row.actual_miles_tenths === null ? null : milesTenths(row.actual_miles_tenths),
    loadedMiles:
      row.loaded_miles_tenths === null ? null : milesTenths(row.loaded_miles_tenths),
    emptyMiles:
      row.empty_miles_tenths === null ? null : milesTenths(row.empty_miles_tenths),
    costs: {
      fuel_cost: costLine(row.fuel_cost_estimated_cents, row.fuel_cost_actual_cents),
      driver_cost: costLine(
        row.driver_cost_estimated_cents,
        row.driver_cost_actual_cents,
      ),
      vehicle_cost: costLine(
        row.vehicle_cost_estimated_cents,
        row.vehicle_cost_actual_cents,
      ),
      toll_cost: costLine(row.toll_cost_estimated_cents, row.toll_cost_actual_cents),
      parking_cost: costLine(
        row.parking_cost_estimated_cents,
        row.parking_cost_actual_cents,
      ),
      other_cost: costLine(row.other_cost_estimated_cents, row.other_cost_actual_cents),
    },
  };
}
