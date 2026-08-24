import { describe, expect, it } from 'vitest';
import {
  calcIncomplete,
  calcNotCalculable,
  calcNotConfigured,
  calcOk,
  combineCalculations,
  isCalculated,
  isEstimated,
  mapCalculation,
  type Calculation,
} from '@/lib/calculation';

describe('Calculation', () => {
  it('marks a complete figure as calculated', () => {
    const c = calcOk(6000);
    expect(isCalculated(c)).toBe(true);
    expect(isEstimated(c)).toBe(false);
  });

  it('marks a figure resting on estimates as estimated', () => {
    const c = calcOk(6000, ['fuel_cost']);
    expect(isCalculated(c)).toBe(true);
    expect(isEstimated(c)).toBe(true);
  });

  it('never reports an incomplete figure as calculated', () => {
    expect(isCalculated(calcIncomplete(['fuel_cost']))).toBe(false);
    expect(isCalculated(calcIncomplete(['fuel_cost'], 19000))).toBe(false);
  });

  it('never reports a not-calculable figure as calculated', () => {
    expect(isCalculated(calcNotCalculable('zero miles'))).toBe(false);
  });

  it('never reports an unconfigured policy as calculated', () => {
    expect(isCalculated(calcNotConfigured('target_margin'))).toBe(false);
  });

  it('preserves provenance through a transform', () => {
    const c = mapCalculation(calcOk(6000, ['fuel_cost']), (v) => v / 100);
    expect(c).toEqual({ status: 'OK', value: 60, usedEstimates: ['fuel_cost'] });
  });

  it('carries missing fields through a transform', () => {
    const c = mapCalculation(calcIncomplete<number>(['fuel_cost']), (v) => v * 2);
    expect(c).toEqual({ status: 'DATA_INCOMPLETE', missing: ['fuel_cost'] });
  });
});

describe('combineCalculations — aggregates never hide a gap', () => {
  const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

  it('sums when every part is complete', () => {
    const parts: Calculation<number>[] = [calcOk(100), calcOk(200), calcOk(300)];
    expect(combineCalculations(parts, sum)).toEqual({ status: 'OK', value: 600 });
  });

  it('is DATA_INCOMPLETE if ANY part is incomplete, naming every gap', () => {
    const parts: Calculation<number>[] = [
      calcOk(100),
      calcIncomplete(['job_54.fuel_cost']),
      calcIncomplete(['job_55.driver_cost']),
    ];
    const result = combineCalculations(parts, sum);
    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['job_54.fuel_cost', 'job_55.driver_cost']);
    }
  });

  it('does not sum the known parts into a misleading total', () => {
    const parts: Calculation<number>[] = [calcOk(100), calcIncomplete(['fuel'])];
    const result = combineCalculations(parts, sum);
    // The known part is 100. A total of 100 would look like a real answer.
    expect(result).not.toHaveProperty('value');
  });

  it('propagates estimate provenance into the total', () => {
    const parts: Calculation<number>[] = [calcOk(100, ['fuel']), calcOk(200)];
    expect(combineCalculations(parts, sum)).toEqual({
      status: 'OK',
      value: 300,
      usedEstimates: ['fuel'],
    });
  });

  it('de-duplicates repeated missing fields', () => {
    const parts: Calculation<number>[] = [
      calcIncomplete(['fuel_cost']),
      calcIncomplete(['fuel_cost']),
    ];
    const result = combineCalculations(parts, sum);
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['fuel_cost']);
    }
  });

  it('ranks NOT_CONFIGURED above other states — policy blocks the sum', () => {
    const parts: Calculation<number>[] = [
      calcIncomplete(['fuel']),
      calcNotConfigured('target_margin'),
    ];
    expect(combineCalculations(parts, sum).status).toBe('NOT_CONFIGURED');
  });

  it('an empty set of parts is a real zero, not a gap', () => {
    expect(combineCalculations<number, number>([], sum)).toEqual({
      status: 'OK',
      value: 0,
    });
  });
});
