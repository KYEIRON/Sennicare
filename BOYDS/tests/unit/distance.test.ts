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
    expect(addMiles(milesTenths(418), milesTenths(736))).toBe(1154);
    expect(subtractMiles(milesTenths(1154), milesTenths(418))).toBe(736);
  });
});

describe('milesFromOdometer', () => {
  it('computes distance from a pair of readings', () => {
    const result = milesFromOdometer(milesTenths(834_120), milesTenths(836_598));
    expect(result).toEqual({ status: 'OK', value: 2478 });
  });

  it('rejects a decreasing odometer rather than returning negative miles', () => {
    const result = milesFromOdometer(milesTenths(836_598), milesTenths(834_120));
    expect(result.status).toBe('NOT_CALCULABLE');
  });

  it('accepts an unchanged odometer as zero miles', () => {
    expect(milesFromOdometer(milesTenths(834_120), milesTenths(834_120))).toEqual({
      status: 'OK',
      value: 0,
    });
  });
});

describe('emptyMileageBps', () => {
  it('computes the empty mileage percentage', () => {
    // 61.2 empty of 247.8 total = 24.70%
    expect(emptyMileageBps(milesTenths(612), milesTenths(2478))).toEqual({
      status: 'OK',
      value: 2470,
    });
  });

  it('returns NOT_CALCULABLE across zero total miles', () => {
    const result = emptyMileageBps(milesTenths(0), milesTenths(0));
    expect(result.status).toBe('NOT_CALCULABLE');
    expect(JSON.stringify(result)).not.toContain('NaN');
  });

  it('handles a fully loaded day as 0%, which is a real answer', () => {
    expect(emptyMileageBps(milesTenths(0), milesTenths(2478))).toEqual({
      status: 'OK',
      value: 0,
    });
  });
});

describe('isConsistentMileageSplit', () => {
  it('accepts a split that accounts for the total', () => {
    expect(
      isConsistentMileageSplit(milesTenths(1866), milesTenths(612), milesTenths(2478)),
    ).toBe(true);
  });

  it('rejects a split that does not', () => {
    expect(
      isConsistentMileageSplit(milesTenths(1866), milesTenths(500), milesTenths(2478)),
    ).toBe(false);
  });
});

describe('gallonsForDistance', () => {
  it('estimates fuel from distance and economy', () => {
    // 247.8 miles at 22.4 MPG = 11.063 gallons
    const result = gallonsForDistance(milesTenths(2478), mpgTenths(224));
    expect(result).toEqual({ status: 'OK', value: 11063 });
  });

  it('returns NOT_CALCULABLE without a positive fuel economy', () => {
    expect(gallonsForDistance(milesTenths(2478), mpgTenths(0)).status).toBe(
      'NOT_CALCULABLE',
    );
  });
});
