/**
 * Data provenance — where a figure on screen actually came from.
 *
 * BOYD'S has a visual design reference (a dashboard mockup) whose figures are
 * illustrative placeholders. It is authoritative for LAYOUT, HIERARCHY,
 * NAVIGATION, COLOUR and KPI PRESENTATION. It is authoritative for NOTHING about
 * business data.
 *
 * The risk this module exists to remove is a specific one: an interface built
 * from a mockup quietly inherits the mockup's numbers, they survive into a seed
 * file, and eventually a partner reads a revenue figure off a dashboard and
 * believes BOYD'S earned it. Once that has happened there is no way to tell, by
 * looking, which figures were real.
 *
 * So provenance is carried by the value itself, and the display layer refuses to
 * render demonstration data without its label.
 *
 * See docs/DECISIONS.md D-014.
 */

/** The label shown wherever illustrative data appears. Never suppressible. */
export const DEMO_DATA_LABEL = 'DEMO DATA';

export type DataProvenance =
  /** Read from BOYD'S own records. The only provenance a business decision may rest on. */
  | 'REAL'
  /** Illustrative. Never a business fact, never aggregated, never reported. */
  | 'DEMO';

/**
 * A value together with where it came from.
 *
 * There is deliberately no function that strips provenance off a value, and no
 * default provenance. A figure reaching the screen has been marked, one way or
 * the other, by whoever produced it.
 */
export type Provenanced<T> = {
  readonly value: T;
  readonly provenance: DataProvenance;
};

export function real<T>(value: T): Provenanced<T> {
  return { value, provenance: 'REAL' };
}

/**
 * Mark a value as illustrative.
 *
 * `reason` is required so that every piece of demonstration data in the codebase
 * states why it exists and what real source is meant to replace it.
 */
export function demo<T>(value: T, reason: string): Provenanced<T> & { reason: string } {
  return { value, provenance: 'DEMO', reason };
}

export function isReal<T>(v: Provenanced<T>): boolean {
  return v.provenance === 'REAL';
}

export function isDemo<T>(v: Provenanced<T>): boolean {
  return v.provenance === 'DEMO';
}

/**
 * Whether the interface must show the DEMO DATA label next to this value.
 *
 * The display layer calls this. It is not a suggestion and there is no override:
 * illustrative data always carries its label.
 */
export function requiresDemoLabel<T>(v: Provenanced<T>): boolean {
  return v.provenance === 'DEMO';
}

/**
 * Provenance of a set of figures.
 *
 * If ANY input is illustrative, the whole result is illustrative. This mirrors
 * the rule for incomplete data: a total assembled from partly-illustrative parts
 * is not a real total, and must never be presented as one.
 */
export function combineProvenance(parts: readonly DataProvenance[]): DataProvenance {
  return parts.includes('DEMO') ? 'DEMO' : 'REAL';
}

/**
 * Guard for any path that must never operate on illustrative data — invoicing,
 * reporting, pricing, AI answers, or anything a partner will make a decision on.
 *
 * Throws rather than returning a Result: demonstration data reaching a real
 * business calculation is a programmer error, not a business condition.
 */
export class DemoDataInRealContextError extends Error {
  constructor(context: string) {
    super(
      `Demonstration data reached "${context}", which must operate on real BOYD'S data only.`,
    );
    this.name = 'DemoDataInRealContextError';
  }
}

export function assertReal<T>(v: Provenanced<T>, context: string): T {
  if (v.provenance !== 'REAL') {
    throw new DemoDataInRealContextError(context);
  }
  return v.value;
}
