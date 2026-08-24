import { describe, expect, it } from 'vitest';
import { addCents, centsPerMile, ratioBps, subtractCents } from '@/lib/money';
import {
  combineCalculations,
  calcIncomplete,
  calcOk,
  isCalculated,
} from '@/lib/calculation';
import { formatCalculation, formatCents } from '@/lib/format';
import { cents, milesTenths, type Cents } from '@/types/branded';

/**
 * The two worked examples from the BOYD'S master build instruction, sections 67
 * and 68, proved on the Phase 1 primitives.
 *
 * The profitability engine proper arrives in Phase 6. These tests exist now so
 * that the foundations everything else will be built on are known to produce the
 * right answers before a single feature rests on them.
 */

describe('Worked example 1 — a profitable job (instruction section 67)', () => {
  const revenue = cents(30_000); // $300.00
  const fuel = cents(8_000); //     $80.00
  const driver = cents(7_000); //   $70.00
  const tollsParking = cents(3_000); // $30.00
  const vehicle = cents(4_000); //  $40.00
  const other = cents(2_000); //    $20.00

  const totalCost = addCents(fuel, driver, tollsParking, vehicle, other);
  const contribution = subtractCents(revenue, totalCost);

  it('totals the cost stack to $240.00', () => {
    expect(totalCost).toBe(24_000);
    expect(formatCents(totalCost)).toBe('$240.00');
  });

  it('reports contribution of $60.00', () => {
    expect(contribution).toBe(6_000);
    expect(formatCents(contribution)).toBe('$60.00');
  });

  it('NEVER reports $300 as profit', () => {
    expect(contribution).not.toBe(revenue);
    expect(formatCents(contribution)).not.toBe('$300.00');
  });

  it('reports a contribution margin of 20.00%', () => {
    expect(ratioBps(contribution, revenue)).toEqual({ status: 'OK', value: 2000 });
  });

  it('reports contribution per mile across 11.5 miles as $5.22', () => {
    expect(centsPerMile(contribution, milesTenths(115))).toEqual({
      status: 'OK',
      value: 522,
    });
  });
});

describe('Worked example 2 — incomplete data (instruction section 68)', () => {
  const revenue = cents(30_000); // $300.00
  const driver = calcOk(cents(7_000)); //  $70.00 actual
  const vehicle = calcOk(cents(4_000)); // $40.00 actual
  const fuel = calcIncomplete<Cents>(['fuel_cost']); // not recorded

  const totalCost = combineCalculations([driver, vehicle, fuel], (values) =>
    addCents(...values),
  );

  it('refuses to total a cost stack with a missing cost', () => {
    expect(totalCost.status).toBe('DATA_INCOMPLETE');
    expect(isCalculated(totalCost)).toBe(false);
  });

  it('names the missing cost so a partner knows what to record', () => {
    if (totalCost.status === 'DATA_INCOMPLETE') {
      expect(totalCost.missing).toEqual(['fuel_cost']);
    }
  });

  it('does not treat the missing fuel cost as zero', () => {
    // Were fuel treated as $0, cost would total $110 and contribution $190.
    // Both would look entirely plausible on a dashboard, and both would be wrong.
    expect(totalCost).not.toHaveProperty('value');
    expect(JSON.stringify(totalCost)).not.toContain('11000');
    expect(JSON.stringify(totalCost)).not.toContain('19000');
  });

  it('displays DATA INCOMPLETE rather than any figure', () => {
    const contribution = combineCalculations([totalCost], (values) =>
      subtractCents(revenue, values[0] ?? cents(0)),
    );
    const shown = formatCalculation(contribution, formatCents);
    expect(shown.text).toBe('DATA INCOMPLETE');
    expect(shown.detail).toBe('Missing: fuel_cost');
  });
});

describe('Worked example 3 — a loss-making job', () => {
  it('reports a real loss rather than flooring at zero', () => {
    const contribution = subtractCents(cents(15_000), cents(24_000));
    expect(contribution).toBe(-9_000);
    expect(formatCents(contribution)).toBe('-$90.00');
    expect(ratioBps(contribution, cents(15_000))).toEqual({
      status: 'OK',
      value: -6000,
    });
  });
});
