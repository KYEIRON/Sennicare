/**
 * Calculation — the type that makes "we do not know" impossible to ignore.
 *
 * BOYD'S must never guess. A cost that has not been recorded is not zero, and a
 * figure divided by zero miles is not zero either. Both are states the business
 * needs to see, so both are values the compiler forces every caller to handle.
 *
 * See docs/DECISIONS.md D-004 and docs/FINANCIAL_ENGINE.md.
 */

export type Calculation<T> =
  /** Every required input was present. */
  | {
      readonly status: 'OK';
      readonly value: T;
      readonly usedEstimates?: readonly string[];
    }
  /**
   * At least one required input is MISSING. `missing` names the fields so the
   * interface can tell a partner exactly what to go and record. `partial` may
   * carry a figure computed from what IS known — it must always be rendered with
   * a DATA INCOMPLETE badge, never as a bare number.
   */
  | {
      readonly status: 'DATA_INCOMPLETE';
      readonly missing: readonly string[];
      readonly partial?: T;
    }
  /** The arithmetic cannot be performed — zero miles, zero revenue. */
  | { readonly status: 'NOT_CALCULABLE'; readonly reason: string }
  /** A business policy this figure depends on has not been decided yet. */
  | { readonly status: 'NOT_CONFIGURED'; readonly setting: string };

export function calcOk<T>(value: T, usedEstimates?: readonly string[]): Calculation<T> {
  return usedEstimates !== undefined && usedEstimates.length > 0
    ? { status: 'OK', value, usedEstimates }
    : { status: 'OK', value };
}

export function calcIncomplete<T>(
  missing: readonly string[],
  partial?: T,
): Calculation<T> {
  return partial === undefined
    ? { status: 'DATA_INCOMPLETE', missing }
    : { status: 'DATA_INCOMPLETE', missing, partial };
}

export function calcNotCalculable<T>(reason: string): Calculation<T> {
  return { status: 'NOT_CALCULABLE', reason };
}

export function calcNotConfigured<T>(setting: string): Calculation<T> {
  return { status: 'NOT_CONFIGURED', setting };
}

/** True only when a real, complete, actual-basis figure is available. */
export function isCalculated<T>(
  c: Calculation<T>,
): c is { status: 'OK'; value: T; usedEstimates?: readonly string[] } {
  return c.status === 'OK';
}

/** True when the figure rests on at least one estimate rather than an actual. */
export function isEstimated<T>(c: Calculation<T>): boolean {
  return c.status === 'OK' && (c.usedEstimates?.length ?? 0) > 0;
}

/** Transform the value of a successful calculation, preserving its provenance. */
export function mapCalculation<T, U>(
  c: Calculation<T>,
  fn: (value: T) => U,
): Calculation<U> {
  switch (c.status) {
    case 'OK':
      return calcOk(fn(c.value), c.usedEstimates);
    case 'DATA_INCOMPLETE':
      return c.partial === undefined
        ? calcIncomplete<U>(c.missing)
        : calcIncomplete<U>(c.missing, fn(c.partial));
    case 'NOT_CALCULABLE':
      return calcNotCalculable<U>(c.reason);
    case 'NOT_CONFIGURED':
      return calcNotConfigured<U>(c.setting);
  }
}

/**
 * Combine calculations, propagating the worst state.
 *
 * This is the rule that stops an aggregate hiding a gap: if ANY constituent job
 * is incomplete, the total is incomplete and names every field responsible.
 * A total assembled from partly-unknown parts is not a total.
 */
export function combineCalculations<T, U>(
  parts: readonly Calculation<T>[],
  combine: (values: readonly T[]) => U,
): Calculation<U> {
  const notConfigured = parts.find((p) => p.status === 'NOT_CONFIGURED');
  if (notConfigured?.status === 'NOT_CONFIGURED') {
    return calcNotConfigured<U>(notConfigured.setting);
  }

  const notCalculable = parts.find((p) => p.status === 'NOT_CALCULABLE');
  if (notCalculable?.status === 'NOT_CALCULABLE') {
    return calcNotCalculable<U>(notCalculable.reason);
  }

  const missing = parts.flatMap((p) => (p.status === 'DATA_INCOMPLETE' ? p.missing : []));
  const usedEstimates = parts.flatMap((p) =>
    p.status === 'OK' ? (p.usedEstimates ?? []) : [],
  );

  if (missing.length > 0) {
    return calcIncomplete<U>(dedupe(missing));
  }

  const values = parts.map((p) => (p as { status: 'OK'; value: T }).value);
  return calcOk(combine(values), dedupe(usedEstimates));
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
