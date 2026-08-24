import { describe, expect, it } from 'vitest';
import {
  allocateVehicleCost,
  deriveCostPerMile,
  isComprehensive,
  type VehicleCostEntryRow,
} from '@/services/finance/vehicle-costs';
import { milesTenths } from '@/types/branded';
import { VEHICLE_COST_LINES } from '@/types/economics';

/** A full calendar year, with 12,000 miles actually driven. */
const YEAR = {
  from: new Date('2026-01-01T00:00:00Z'),
  to: new Date('2027-01-01T00:00:00Z'),
  milesTenths: milesTenths(120_000),
};

function entry(overrides: Partial<VehicleCostEntryRow> = {}): VehicleCostEntryRow {
  return {
    cost_line: 'INSURANCE',
    period: 'ANNUAL',
    amount_cents: 120_000,
    included_in_cost_per_mile: true,
    effective_from: '2026-01-01',
    effective_to: null,
    ...overrides,
  };
}

describe('there is no way to declare a flat rate', () => {
  it('requires cost entries — a vehicle with none is INCOMPLETE, not free', () => {
    const result = deriveCostPerMile([], YEAR);
    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['vehicle_cost_entries']);
    }
  });

  it('refuses a rate across zero miles rather than returning zero', () => {
    const result = deriveCostPerMile([entry()], { ...YEAR, milesTenths: milesTenths(0) });
    expect(result.status).toBe('NOT_CALCULABLE');
    expect(JSON.stringify(result)).not.toContain('Infinity');
  });
});

describe('deriving the rate', () => {
  it('spreads an annual cost across the year', () => {
    // $1,200 insurance over 12,000 miles = 10 cents per mile.
    const result = deriveCostPerMile([entry()], YEAR);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') expect(result.value.costPerMile).toBe(10);
  });

  it('spreads a monthly cost across the year', () => {
    // $100/month = $1,200/year over 12,000 miles = 10 cents per mile.
    const result = deriveCostPerMile(
      [entry({ period: 'MONTHLY', amount_cents: 10_000 })],
      YEAR,
    );
    if (result.status === 'OK') expect(result.value.costPerMile).toBe(10);
  });

  it('counts a one-off repair in full when it falls inside the window', () => {
    // $600 repair over 12,000 miles = 5 cents per mile.
    const result = deriveCostPerMile(
      [
        entry({
          cost_line: 'REPAIRS',
          period: 'ONE_OFF',
          amount_cents: 60_000,
          effective_from: '2026-06-15',
        }),
      ],
      YEAR,
    );
    if (result.status === 'OK') expect(result.value.costPerMile).toBe(5);
  });

  it('ignores a one-off outside the window', () => {
    const result = deriveCostPerMile(
      [entry({ period: 'ONE_OFF', amount_cents: 60_000, effective_from: '2025-06-15' })],
      YEAR,
    );
    expect(result.status).toBe('DATA_INCOMPLETE');
  });

  it('sums several lines', () => {
    const result = deriveCostPerMile(
      [
        entry({ cost_line: 'INSURANCE', amount_cents: 120_000 }),
        entry({ cost_line: 'FINANCE', period: 'MONTHLY', amount_cents: 10_000 }),
      ],
      YEAR,
    );
    if (result.status === 'OK') expect(result.value.costPerMile).toBe(20);
  });

  it('applies a per-mile line directly', () => {
    const result = deriveCostPerMile(
      [entry({ cost_line: 'TYRES', period: 'PER_MILE', amount_cents: 3 })],
      YEAR,
    );
    if (result.status === 'OK') expect(result.value.costPerMile).toBe(3);
  });

  it('excludes a line the partners have switched off', () => {
    const result = deriveCostPerMile(
      [
        entry({ cost_line: 'INSURANCE', amount_cents: 120_000 }),
        entry({
          cost_line: 'DEPRECIATION',
          amount_cents: 240_000,
          included_in_cost_per_mile: false,
        }),
      ],
      YEAR,
    );
    if (result.status === 'OK') {
      expect(result.value.costPerMile).toBe(10);
      expect(result.value.linesIncluded).toEqual(['INSURANCE']);
    }
  });

  it('prorates a cost that only covers part of the window', () => {
    // Six months of a $1,200/year policy is about $600 over 12,000 miles ≈ 5c.
    const result = deriveCostPerMile(
      [entry({ effective_from: '2026-07-01', effective_to: '2027-01-01' })],
      YEAR,
    );
    if (result.status === 'OK') {
      expect(result.value.costPerMile).toBeGreaterThanOrEqual(4);
      expect(result.value.costPerMile).toBeLessThanOrEqual(6);
    }
  });
});

describe('a partial rate says so', () => {
  it('reports which lines it covers and which are missing', () => {
    const result = deriveCostPerMile([entry({ cost_line: 'FUEL' })], YEAR);

    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.value.linesIncluded).toEqual(['FUEL']);
      expect(result.value.linesExcludedForMissingData).toEqual(
        VEHICLE_COST_LINES.filter((line) => line !== 'FUEL'),
      );
      expect(isComprehensive(result.value)).toBe(false);
    }
  });

  it('is comprehensive only when every line has data', () => {
    const entries = VEHICLE_COST_LINES.map((line) =>
      entry({ cost_line: line, amount_cents: 12_000 }),
    );
    const result = deriveCostPerMile(entries, YEAR);

    if (result.status === 'OK') {
      expect(result.value.linesExcludedForMissingData).toEqual([]);
      expect(isComprehensive(result.value)).toBe(true);
    }
  });

  it('records the mileage the figure was divided by', () => {
    const result = deriveCostPerMile([entry()], YEAR);
    if (result.status === 'OK') expect(result.value.milesBasis).toBe(12_000);
  });
});

describe('allocating to a job', () => {
  const rate = deriveCostPerMile([entry()], YEAR);

  it('applies the derived rate to the job miles', () => {
    // 10c per mile over 24.7 miles = $2.47.
    expect(allocateVehicleCost(rate, milesTenths(247))).toEqual({
      status: 'OK',
      value: 247,
    });
  });

  it('is INCOMPLETE, not zero, when no rate can be derived', () => {
    const noRate = deriveCostPerMile([], YEAR);
    const result = allocateVehicleCost(noRate, milesTenths(247));

    expect(result.status).toBe('DATA_INCOMPLETE');
    expect(JSON.stringify(result)).not.toContain('"value":0');
  });

  it('is INCOMPLETE when the job has no recorded mileage', () => {
    const result = allocateVehicleCost(rate, null);
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['actual_miles']);
    }
  });

  it('propagates NOT_CALCULABLE from the rate', () => {
    const zeroMiles = deriveCostPerMile([entry()], {
      ...YEAR,
      milesTenths: milesTenths(0),
    });
    expect(allocateVehicleCost(zeroMiles, milesTenths(247)).status).toBe(
      'NOT_CALCULABLE',
    );
  });
});
