import { describe, expect, it } from 'vitest';
import {
  addCents,
  applyBps,
  centsPerMile,
  isNegative,
  multiplyCents,
  negateCents,
  parseUsdToCents,
  ratioBps,
  subtractCents,
} from '@/lib/money';
import { bps, cents, milesTenths } from '@/types/branded';
import { InvalidQuantityError } from '@/types/branded';

describe('money arithmetic', () => {
  it('adds and subtracts exactly', () => {
    expect(addCents(cents(8000), cents(7000), cents(3000))).toBe(18000);
    expect(subtractCents(cents(30000), cents(24000))).toBe(6000);
  });

  it('produces a negative contribution on a loss-making job', () => {
    const contribution = subtractCents(cents(15000), cents(24000));
    expect(contribution).toBe(-9000);
    expect(isNegative(contribution)).toBe(true);
  });

  it('negates', () => {
    expect(negateCents(cents(500))).toBe(-500);
  });

  it('does not accumulate floating point error across many additions', () => {
    // 0.1 + 0.2 !== 0.3 in floating point. In cents it is exact, every time.
    const tenCentsHundredTimes = Array.from({ length: 100 }, () => cents(10));
    expect(addCents(...tenCentsHundredTimes)).toBe(1000);
  });

  it('rounds half away from zero so losses are as accurate as profits', () => {
    expect(multiplyCents(cents(101), 0.5)).toBe(51);
    expect(multiplyCents(cents(-101), 0.5)).toBe(-51);
  });

  it('applies basis points', () => {
    expect(applyBps(cents(10000), bps(2000))).toBe(2000);
    expect(applyBps(cents(30000), bps(1500))).toBe(4500);
  });

  it('rejects a non-integer quantity as programmer error', () => {
    expect(() => cents(10.5)).toThrow(InvalidQuantityError);
    expect(() => cents(Number.NaN)).toThrow(InvalidQuantityError);
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow(InvalidQuantityError);
  });
});

describe('centsPerMile', () => {
  it('divides money across distance', () => {
    // $60.00 contribution across 11.5 miles = $5.21/mi
    const result = centsPerMile(cents(6000), milesTenths(115));
    expect(result.status).toBe('OK');
    if (result.status === 'OK') expect(result.value).toBe(522);
  });

  it('returns NOT_CALCULABLE across zero miles — never Infinity or zero', () => {
    const result = centsPerMile(cents(6000), milesTenths(0));
    expect(result.status).toBe('NOT_CALCULABLE');
    expect(JSON.stringify(result)).not.toContain('Infinity');
  });
});

describe('ratioBps', () => {
  it('computes a contribution margin', () => {
    // $60 contribution on $300 revenue = 20.00%
    const result = ratioBps(cents(6000), cents(30000));
    expect(result).toEqual({ status: 'OK', value: 2000 });
  });

  it('computes a negative margin on a loss', () => {
    // -$90 on $150 revenue = -60.00%
    const result = ratioBps(cents(-9000), cents(15000));
    expect(result).toEqual({ status: 'OK', value: -6000 });
  });

  it('returns NOT_CALCULABLE on zero revenue', () => {
    expect(ratioBps(cents(6000), cents(0)).status).toBe('NOT_CALCULABLE');
  });
});

describe('parseUsdToCents', () => {
  it.each([
    ['300', 30000],
    ['300.00', 30000],
    ['$1,234.56', 123456],
    ['0.05', 5],
    ['0.5', 50],
    ['-99.99', -9999],
    [300, 30000],
    [80.5, 8050],
  ])('parses %p to %p cents', (input, expected) => {
    const result = parseUsdToCents(input);
    expect(result).toEqual({ status: 'OK', value: expected });
  });

  it.each(['', 'abc', '1.234', '12,34.5', '$', '1.2.3'])(
    'rejects %p rather than defaulting to zero',
    (input) => {
      expect(parseUsdToCents(input).status).toBe('NOT_CALCULABLE');
    },
  );
});
