/**
 * True cost per mile — derived, never declared.
 *
 * There is no function here that accepts a flat rate. The rate comes from real
 * recorded costs divided by real recorded mileage, and the result always says
 * which cost lines it covers.
 *
 * The distinction matters because a partial figure is easy to mistake for a
 * complete one. A cost per mile covering only fuel and insurance is a real
 * number, and it is not the vehicle's true cost per mile. Reporting the lines
 * included is what stops that confusion becoming a pricing error.
 *
 * See docs/DECISIONS.md D-012 and docs/FINANCIAL_ENGINE.md section 6.
 */

import { cents, type Cents, type MilesTenths } from '@/types/branded';
import {
  calcIncomplete,
  calcNotCalculable,
  calcOk,
  type Calculation,
} from '@/lib/calculation';
import { addCents } from '@/lib/money';
import {
  VEHICLE_COST_LINES,
  type DerivedCostPerMile,
  type VehicleCostLine,
} from '@/types/economics';

export type VehicleCostPeriod = 'MONTHLY' | 'ANNUAL' | 'PER_MILE' | 'ONE_OFF';

export interface VehicleCostEntryRow {
  readonly cost_line: VehicleCostLine;
  readonly period: VehicleCostPeriod;
  readonly amount_cents: number;
  readonly included_in_cost_per_mile: boolean;
  readonly effective_from: string;
  readonly effective_to: string | null;
}

export interface CostPerMileWindow {
  /** Inclusive. */
  readonly from: Date;
  /** Exclusive. */
  readonly to: Date;
  /** Real miles the vehicle covered in that window. */
  readonly milesTenths: MilesTenths;
}

const MILLISECONDS_PER_DAY = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY));
}

/** The portion of an entry's period that overlaps the window under analysis. */
function overlappingDays(entry: VehicleCostEntryRow, window: CostPerMileWindow): number {
  const entryFrom = new Date(entry.effective_from);
  const entryTo = entry.effective_to ? new Date(entry.effective_to) : window.to;

  const from = entryFrom > window.from ? entryFrom : window.from;
  const to = entryTo < window.to ? entryTo : window.to;

  return daysBetween(from, to);
}

/**
 * Convert one cost entry into the amount attributable to the window.
 *
 * A monthly insurance premium contributes the fraction of it that falls inside
 * the window; a one-off repair contributes in full if it happened inside it.
 * `PER_MILE` entries are handled separately because they scale with distance
 * rather than time.
 */
function amountInWindow(
  entry: VehicleCostEntryRow,
  window: CostPerMileWindow,
): Cents | null {
  const days = overlappingDays(entry, window);
  if (days === 0 && entry.period !== 'ONE_OFF') return null;

  switch (entry.period) {
    case 'MONTHLY':
      // 365.25 / 12 keeps leap years from quietly biasing a long window.
      return cents(Math.round((entry.amount_cents / 30.4375) * days));
    case 'ANNUAL':
      return cents(Math.round((entry.amount_cents / 365.25) * days));
    case 'ONE_OFF': {
      const occurred = new Date(entry.effective_from);
      return occurred >= window.from && occurred < window.to
        ? cents(entry.amount_cents)
        : null;
    }
    case 'PER_MILE':
      return cents(Math.round((entry.amount_cents * window.milesTenths) / 10));
  }
}

/**
 * Derive true cost per mile for a vehicle over a window.
 *
 * Returns NOT_CALCULABLE across zero miles — a cost per mile with no miles is
 * undefined, not zero. Returns DATA_INCOMPLETE when no cost entries exist at
 * all, because a vehicle with no recorded costs did not run for free.
 */
export function deriveCostPerMile(
  entries: readonly VehicleCostEntryRow[],
  window: CostPerMileWindow,
): Calculation<DerivedCostPerMile> {
  const included = entries.filter((entry) => entry.included_in_cost_per_mile);

  if (included.length === 0) {
    return calcIncomplete<DerivedCostPerMile>(['vehicle_cost_entries']);
  }

  if (window.milesTenths <= 0) {
    return calcNotCalculable('Cannot derive a cost per mile across zero recorded miles.');
  }

  const contributions: Cents[] = [];
  const linesIncluded = new Set<VehicleCostLine>();

  for (const entry of included) {
    const amount = amountInWindow(entry, window);
    if (amount === null) continue;

    contributions.push(amount);
    linesIncluded.add(entry.cost_line);
  }

  if (contributions.length === 0) {
    return calcIncomplete<DerivedCostPerMile>(['vehicle_cost_entries (in this period)']);
  }

  const total = addCents(...contributions);
  const miles = window.milesTenths / 10;

  const excluded = VEHICLE_COST_LINES.filter((line) => !linesIncluded.has(line));

  return calcOk({
    costPerMile: cents(Math.round(total / miles)),
    linesIncluded: [...linesIncluded],
    linesExcludedForMissingData: excluded,
    milesBasis: miles,
    periodStart: window.from,
    periodEnd: window.to,
  });
}

/**
 * Allocate a derived rate to a job.
 *
 * Returns DATA_INCOMPLETE rather than zero when no rate can be derived. A
 * missing vehicle cost is not a free van, and treating it as zero would
 * overstate contribution on every job.
 */
export function allocateVehicleCost(
  costPerMile: Calculation<DerivedCostPerMile>,
  jobMilesTenths: MilesTenths | null,
): Calculation<Cents> {
  if (jobMilesTenths === null) {
    return calcIncomplete<Cents>(['actual_miles']);
  }

  if (costPerMile.status !== 'OK') {
    return costPerMile.status === 'DATA_INCOMPLETE'
      ? calcIncomplete<Cents>(costPerMile.missing)
      : (costPerMile as Calculation<Cents>);
  }

  return calcOk(cents(Math.round((costPerMile.value.costPerMile * jobMilesTenths) / 10)));
}

/**
 * Whether a derived rate covers every cost line BOYD'S tracks.
 *
 * A rate covering three lines out of nine is a real figure and a poor basis for
 * pricing. The interface uses this to say so rather than presenting a partial
 * derivation as the whole picture.
 */
export function isComprehensive(derived: DerivedCostPerMile): boolean {
  return derived.linesExcludedForMissingData.length === 0;
}
