/**
 * Money arithmetic for BOYD'S. Integer cents throughout.
 *
 * Nothing outside this module may perform arithmetic on a monetary value, and
 * nothing anywhere may represent money as a float. See docs/DECISIONS.md D-003.
 */

import { cents, type Bps, type Cents, type MilesTenths } from '@/types/branded';
import { calcNotCalculable, calcOk, type Calculation } from './calculation';

export function addCents(...values: readonly Cents[]): Cents {
  return cents(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function negateCents(a: Cents): Cents {
  return cents(-a);
}

export function isNegative(a: Cents): boolean {
  return a < 0;
}

export function multiplyCents(amount: Cents, factor: number): Cents {
  return cents(roundHalfAwayFromZero(amount * factor));
}

/** Apply a basis-point rate. 2000 bps of $100.00 is $20.00. */
export function applyBps(amount: Cents, rate: Bps): Cents {
  return cents(roundHalfAwayFromZero((amount * rate) / 10_000));
}

/**
 * Divide money by distance, yielding cents per mile.
 *
 * Returns NOT_CALCULABLE on zero miles rather than Infinity, NaN, or a silent
 * zero. This guard is business rule 15.
 */
export function centsPerMile(amount: Cents, distance: MilesTenths): Calculation<Cents> {
  if (distance === 0) {
    return calcNotCalculable('Cannot calculate a per-mile figure across zero miles.');
  }
  const miles = distance / 10;
  return calcOk(cents(roundHalfAwayFromZero(amount / miles)));
}

/**
 * Express one amount as a proportion of another, in basis points.
 *
 * Returns NOT_CALCULABLE on a zero base — a margin on zero revenue is not zero
 * percent, it is undefined.
 */
export function ratioBps(part: Cents, whole: Cents): Calculation<Bps> {
  if (whole === 0) {
    return calcNotCalculable('Cannot calculate a percentage of zero.');
  }
  return calcOk(roundHalfAwayFromZero((part / whole) * 10_000) as Bps);
}

/**
 * Parse a US dollar string or number into cents without floating-point drift.
 *
 * Accepts "1,234.56", "$1,234.56", "1234.5", "-99.99", 1234.56.
 * Rejects anything else — malformed money is a validation failure, not a zero.
 */
export function parseUsdToCents(input: string | number): Calculation<Cents> {
  const raw = typeof input === 'number' ? input.toFixed(2) : input;
  const withoutSymbols = raw.trim().replace(/[$\s]/g, '');

  // Thousands separators must be correctly grouped. "12,34.5" is a typo, and
  // reading it as $1,234.50 would be an order-of-magnitude error on an invoice.
  if (!/^-?(\d{1,3}(,\d{3})*|\d+)(\.\d{1,2})?$/.test(withoutSymbols)) {
    return calcNotCalculable(`"${input}" is not a valid US dollar amount.`);
  }

  const cleaned = withoutSymbols.replace(/,/g, '');
  const negative = cleaned.startsWith('-');
  const digits = negative ? cleaned.slice(1) : cleaned;
  const [whole = '0', fraction = ''] = digits.split('.');
  const paddedFraction = fraction.padEnd(2, '0');

  const total = Number(whole) * 100 + Number(paddedFraction);
  return calcOk(cents(negative ? -total : total));
}

/**
 * Round half away from zero.
 *
 * JavaScript's Math.round rounds -0.5 to -0, which would systematically favour
 * BOYD'S on losses and understate them. Losses must be as accurate as profits.
 */
function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}
