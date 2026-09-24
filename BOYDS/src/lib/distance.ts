/**
 * Distance arithmetic for BOYD'S. Integer tenths of a mile throughout.
 *
 * Miles matter here as much as money: contribution per mile and empty mileage
 * percentage are two of the business's primary metrics.
 */

import { milesTenths, type Bps, type MilesTenths, type MpgTenths } from '@/types/branded';
import { calcNotCalculable, calcOk, type Calculation } from './calculation';
import { type GallonsThousandths, gallonsThousandths } from '@/types/branded';

export function addMiles(...values: readonly MilesTenths[]): MilesTenths {
  return milesTenths(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtractMiles(a: MilesTenths, b: MilesTenths): MilesTenths {
  return milesTenths(a - b);
}

/**
 * Total miles from an odometer pair.
 *
 * A decreasing odometer is rejected rather than producing negative mileage —
 * business rule 22.
 */
export function milesFromOdometer(
  start: MilesTenths,
  end: MilesTenths,
): Calculation<MilesTenths> {
  if (end < start) {
    return calcNotCalculable(
      `Odometer decreased: ended at ${end / 10} having started at ${start / 10}.`,
    );
  }
  return calcOk(milesTenths(end - start));
}

/**
 * Empty mileage as a proportion of total, in basis points.
 *
 * One of BOYD'S strategic metrics. Zero total miles yields NOT_CALCULABLE.
 */
export function emptyMileageBps(
  emptyMiles: MilesTenths,
  totalMiles: MilesTenths,
): Calculation<Bps> {
  if (totalMiles === 0) {
    return calcNotCalculable('Cannot calculate empty mileage across zero total miles.');
  }
  return calcOk(Math.round((emptyMiles / totalMiles) * 10_000) as Bps);
}

/**
 * Check that a loaded/empty split accounts for exactly the total.
 *
 * Business rule 21: total = loaded + empty. A log that breaks this is rejected
 * rather than silently absorbed into one bucket.
 */
export function isConsistentMileageSplit(
  loaded: MilesTenths,
  empty: MilesTenths,
  total: MilesTenths,
): boolean {
  return loaded + empty === total;
}

/** Fuel consumed over a distance at a given economy. */
export function gallonsForDistance(
  distance: MilesTenths,
  economy: MpgTenths,
): Calculation<GallonsThousandths> {
  if (economy <= 0) {
    return calcNotCalculable('Cannot estimate fuel without a positive fuel economy.');
  }
  const miles = distance / 10;
  const mpg = economy / 10;
  return calcOk(gallonsThousandths(Math.round((miles / mpg) * 1000)));
}
