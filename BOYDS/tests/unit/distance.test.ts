import { describe, expect, it } from 'vitest';
import {
  addMiles,
  emptyMileageBps,
  gallonsForDistance,
  isConsistentMileageSplit,
  milesFromOdometer,
  subtractMiles,
} from '@/lib/distance';
import { milesTenths, mpgTenths } from '@/types/branded';

describe('distance arithmetic', () => {
  it('adds and subtracts exactly in tenths', () => {
    expect(addMiles(milesTenths(450), milesTenths(780))).toBe(1230);
    expect(subtractMiles(milesTenths(1560), milesTenths(450))).toBe(1110);
  });
});

describe('milesFromOdometer', () => {
  it('computes distance from a pair of readings', () => {
    const result = milesFromOdometer(milesTenths(120000), milesTenths(121560));
    expect(result).toEqual({ status: 'OK', value: 1560 });
  });

  it('rejects a decreasing odometer rather than returning negative miles', () => {
    const result = milesFromOdometer(milesTenths(121560), milesTenths(120000));
    expect(result.status).toBe('NOT_CALCULABLE');
  });

  it('accepts an unchanged odometer as zero miles', () => {
    expect(milesFromOdometer(milesTenths(120000), milesTenths(120000))).toEqual({
      status: 'OK',
      value: 0,
    });
  });
});

describe('emptyMileageBps', () => {
  it('computes the empty mileage percentage', () => {
    // 40 empty of 160 total = 25.00%
    expect(emptyMileageBps(milesTenths(400), milesTenths(1600))).toEqual({
      status: 'OK',
      value: 2500,
    });
  });

  it('returns NOT_CALCULABLE across zero total miles', () => {
    const result = emptyMileageBps(milesTenths(0), milesTenths(0));
    expect(result.status).toBe('NOT_CALCULABLE');
    expect(JSON.stringify(result)).not.toContain('NaN');
  });

  it('handles a fully loaded day as 0%, which is a real answer', () => {
    expect(emptyMileageBps(milesTenths(0), milesTenths(1600))).toEqual({
      status: 'OK',
      value: 0,
    });
  });
});

describe('isConsistentMileageSplit', () => {
  it('accepts a split that accounts for the total', () => {
    expect(
      isConsistentMileageSplit(milesTenths(1200), milesTenths(400), milesTenths(1600)),
    ).toBe(true);
  });

  it('rejects a split that does not', () => {
    expect(
      isConsistentMileageSplit(milesTenths(1200), milesTenths(300), milesTenths(1600)),
    ).toBe(false);
  });
});

describe('gallonsForDistance', () => {
  it('estimates fuel from distance and economy', () => {
    // 156.0 miles at 18.6 MPG = 8.387 gallons
    const result = gallonsForDistance(milesTenths(1560), mpgTenths(186));
    expect(result).toEqual({ status: 'OK', value: 8387 });
  });

  it('returns NOT_CALCULABLE without a positive fuel economy', () => {
    expect(gallonsForDistance(milesTenths(1560), mpgTenths(0)).status).toBe(
      'NOT_CALCULABLE',
    );
  });
});
