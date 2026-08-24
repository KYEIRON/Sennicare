/**
 * Display formatting for BOYD'S. The ONLY place a stored integer becomes a
 * human-readable string, and the only place rounding for display happens.
 *
 * Locale is en-US, currency USD, distance miles, volume gallons, time zone
 * America/New_York. These are business facts about a US company, not a
 * preference of whoever is looking at the screen.
 */

import type {
  Bps,
  Cents,
  GallonsThousandths,
  MilesTenths,
  MpgTenths,
} from '@/types/branded';
import type { Calculation } from './calculation';

export const LOCALE = 'en-US';
export const CURRENCY = 'USD';
export const TIME_ZONE = 'America/New_York';

/** The label shown wherever a figure cannot be honestly stated. */
export const DATA_INCOMPLETE_LABEL = 'DATA INCOMPLETE';
export const NOT_CALCULABLE_LABEL = 'NOT CALCULABLE';
export const NOT_CONFIGURED_LABEL = 'NOT CONFIGURED';

const usd = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$1,234.56". Negative amounts render as "-$90.00" — a loss looks like a loss. */
export function formatCents(value: Cents): string {
  return usd.format(value / 100);
}

/** "123.4 mi" */
export function formatMiles(value: MilesTenths): string {
  return `${(value / 10).toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mi`;
}

/** "12.340 gal" */
export function formatGallons(value: GallonsThousandths): string {
  return `${(value / 1000).toLocaleString(LOCALE, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} gal`;
}

/** "18.6 MPG" */
export function formatMpg(value: MpgTenths): string {
  return `${(value / 10).toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MPG`;
}

/** "20.00%" */
export function formatBps(value: Bps): string {
  return `${(value / 100).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

/** "$5.21 / mi" */
export function formatCentsPerMile(value: Cents): string {
  return `${formatCents(value)} / mi`;
}

/**
 * Render a Calculation for display.
 *
 * This is the function that enforces the business's central honesty rule: a
 * figure that is not fully known NEVER renders as a bare number. Callers get a
 * label and a flag, so the interface can badge it correctly.
 */
export interface DisplayedCalculation {
  readonly text: string;
  readonly status: Calculation<unknown>['status'];
  /** True when the interface must show a warning badge alongside the value. */
  readonly needsBadge: boolean;
  /** Present when the figure rests on estimates or has missing inputs. */
  readonly detail?: string;
}

export function formatCalculation<T>(
  calculation: Calculation<T>,
  formatValue: (value: T) => string,
): DisplayedCalculation {
  switch (calculation.status) {
    case 'OK': {
      const estimates = calculation.usedEstimates ?? [];
      return estimates.length > 0
        ? {
            text: formatValue(calculation.value),
            status: 'OK',
            needsBadge: true,
            detail: `ESTIMATE — based on estimated ${estimates.join(', ')}`,
          }
        : { text: formatValue(calculation.value), status: 'OK', needsBadge: false };
    }
    case 'DATA_INCOMPLETE':
      return {
        text: DATA_INCOMPLETE_LABEL,
        status: 'DATA_INCOMPLETE',
        needsBadge: true,
        detail: `Missing: ${calculation.missing.join(', ')}`,
      };
    case 'NOT_CALCULABLE':
      return {
        text: NOT_CALCULABLE_LABEL,
        status: 'NOT_CALCULABLE',
        needsBadge: true,
        detail: calculation.reason,
      };
    case 'NOT_CONFIGURED':
      return {
        text: NOT_CONFIGURED_LABEL,
        status: 'NOT_CONFIGURED',
        needsBadge: true,
        detail: `Business decision required: ${calculation.setting}`,
      };
  }
}
