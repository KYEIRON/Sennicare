/**
 * Branded primitive types for BOYD'S.
 *
 * BOYD'S measures profit. Floating-point arithmetic loses money, and a bare
 * `number` gives the compiler no way to stop dollars being added to miles.
 * Every physical quantity in the system is therefore an integer in its smallest
 * unit, wearing a brand the type system enforces.
 *
 * See docs/DECISIONS.md D-003.
 */

declare const brand: unique symbol;

type Brand<T, B> = T & { readonly [brand]: B };

/** United States dollars, stored as whole cents. `12345` is $123.45. */
export type Cents = Brand<number, 'Cents'>;

/** Distance in miles, stored as whole tenths. `1234` is 123.4 miles. */
export type MilesTenths = Brand<number, 'MilesTenths'>;

/** Fuel volume in US gallons, stored as whole thousandths. `12340` is 12.340 gal. */
export type GallonsThousandths = Brand<number, 'GallonsThousandths'>;

/** A rate or percentage in basis points. `2000` is 20.00%. */
export type Bps = Brand<number, 'Bps'>;

/** Miles per US gallon, stored as whole tenths. `186` is 18.6 MPG. */
export type MpgTenths = Brand<number, 'MpgTenths'>;

/**
 * Thrown only for programmer error — a non-integer or non-finite value reaching
 * a constructor. It never represents a business condition; business conditions
 * are values, not exceptions. See src/lib/calculation.ts.
 */
export class InvalidQuantityError extends Error {
  constructor(kind: string, value: number) {
    super(`Invalid ${kind}: ${value}. Must be a finite integer.`);
    this.name = 'InvalidQuantityError';
  }
}

function assertSafeInteger(kind: string, value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidQuantityError(kind, value);
  }
}

/** Construct `Cents` from a whole number of cents. Negative is legal — a loss. */
export function cents(value: number): Cents {
  assertSafeInteger('Cents', value);
  return value as Cents;
}

/** Construct `MilesTenths` from a whole number of tenths of a mile. */
export function milesTenths(value: number): MilesTenths {
  assertSafeInteger('MilesTenths', value);
  return value as MilesTenths;
}

/** Construct `GallonsThousandths` from a whole number of thousandths of a gallon. */
export function gallonsThousandths(value: number): GallonsThousandths {
  assertSafeInteger('GallonsThousandths', value);
  return value as GallonsThousandths;
}

/** Construct `Bps` from a whole number of basis points. */
export function bps(value: number): Bps {
  assertSafeInteger('Bps', value);
  return value as Bps;
}

/** Construct `MpgTenths` from a whole number of tenths of a mile per gallon. */
export function mpgTenths(value: number): MpgTenths {
  assertSafeInteger('MpgTenths', value);
  return value as MpgTenths;
}

/** Zero dollars. */
export const ZERO_CENTS = cents(0);

/** Zero miles. */
export const ZERO_MILES = milesTenths(0);
