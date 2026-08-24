import { describe, expect, it } from 'vitest';
import {
  DATA_INCOMPLETE_LABEL,
  NOT_CALCULABLE_LABEL,
  NOT_CONFIGURED_LABEL,
  formatBps,
  formatCalculation,
  formatCents,
  formatCentsPerMile,
  formatGallons,
  formatMiles,
  formatMpg,
} from '@/lib/format';
import {
  calcIncomplete,
  calcNotCalculable,
  calcNotConfigured,
  calcOk,
} from '@/lib/calculation';
import { bps, cents, gallonsThousandths, milesTenths, mpgTenths } from '@/types/branded';

describe('formatting', () => {
  it('formats US dollars', () => {
    expect(formatCents(cents(98765))).toBe('$987.65');
    expect(formatCents(cents(4207))).toBe('$42.07');
    expect(formatCents(cents(0))).toBe('$0.00');
  });

  it('formats a loss as a visible negative', () => {
    expect(formatCents(cents(-9000))).toBe('-$90.00');
  });

  it('formats miles, gallons, MPG and percentages', () => {
    expect(formatMiles(milesTenths(2478))).toBe('247.8 mi');
    expect(formatGallons(gallonsThousandths(9750))).toBe('9.750 gal');
    expect(formatMpg(mpgTenths(224))).toBe('22.4 MPG');
    expect(formatBps(bps(1750))).toBe('17.50%');
    expect(formatCentsPerMile(cents(308))).toBe('$3.08 / mi');
  });
});

describe('formatCalculation — the honesty rule at the display edge', () => {
  it('shows a complete figure plainly, with no badge', () => {
    const shown = formatCalculation(calcOk(cents(6000)), formatCents);
    expect(shown).toEqual({ text: '$60.00', status: 'OK', needsBadge: false });
  });

  it('badges a figure that rests on an estimate', () => {
    const shown = formatCalculation(calcOk(cents(6000), ['fuel_cost']), formatCents);
    expect(shown.text).toBe('$60.00');
    expect(shown.needsBadge).toBe(true);
    expect(shown.detail).toContain('ESTIMATE');
  });

  it('NEVER renders a number when data is incomplete, even with a partial', () => {
    const shown = formatCalculation(
      calcIncomplete(['fuel_cost'], cents(19000)),
      formatCents,
    );
    expect(shown.text).toBe(DATA_INCOMPLETE_LABEL);
    expect(shown.text).not.toContain('190');
    expect(shown.needsBadge).toBe(true);
    expect(shown.detail).toBe('Missing: fuel_cost');
  });

  it('renders NOT CALCULABLE rather than a zero or an Infinity', () => {
    const shown = formatCalculation(
      calcNotCalculable<ReturnType<typeof cents>>('zero miles'),
      formatCents,
    );
    expect(shown.text).toBe(NOT_CALCULABLE_LABEL);
    expect(shown.text).not.toContain('0');
  });

  it('renders NOT CONFIGURED and names the business decision needed', () => {
    const shown = formatCalculation(
      calcNotConfigured<ReturnType<typeof cents>>('target_contribution_margin'),
      formatCents,
    );
    expect(shown.text).toBe(NOT_CONFIGURED_LABEL);
    expect(shown.detail).toContain('target_contribution_margin');
  });
});
