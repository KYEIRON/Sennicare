import { describe, expect, it } from 'vitest';
import {
  formatOperatingDate,
  formatOperatingTime,
  isAfterHours,
  operatingDateKey,
  operatingHour,
} from '@/lib/datetime';

/**
 * BOYD'S operates in America/New_York. These tests pin that down, because
 * Ronald manages the business from the United Kingdom and a UK-time assumption
 * leaking in would misclassify after-hours requests by five hours.
 */
describe('operating time zone', () => {
  it('renders a date in Eastern time', () => {
    // 2025-09-16 18:30 UTC = 2:30 PM EDT
    const instant = new Date('2025-09-16T18:30:00Z');
    expect(formatOperatingDate(instant)).toBe('Tuesday, September 16, 2025');
    expect(formatOperatingTime(instant)).toBe('2:30 PM EDT');
  });

  it('uses the US business day, not the UK one', () => {
    // 2025-09-17 02:00 UTC is still 2025-09-16 in North Carolina (10 PM EDT),
    // while in the United Kingdom it is already the 17th.
    const instant = new Date('2025-09-17T02:00:00Z');
    expect(operatingDateKey(instant)).toBe('2025-09-16');
    expect(operatingHour(instant)).toBe(22);
  });

  it('handles the winter offset as well as the summer one', () => {
    // 2025-02-11 18:30 UTC = 1:30 PM EST
    const instant = new Date('2025-02-11T18:30:00Z');
    expect(formatOperatingTime(instant)).toBe('1:30 PM EST');
  });
});

describe('after-hours detection — the 2 AM scenario', () => {
  it('marks 02:00 Eastern as after hours', () => {
    // 06:00 UTC = 2:00 AM EDT
    expect(isAfterHours(new Date('2025-09-16T06:00:00Z'))).toBe(true);
  });

  it('marks 02:00 Eastern as after hours in winter too', () => {
    // 07:00 UTC = 2:00 AM EST
    expect(isAfterHours(new Date('2025-02-11T07:00:00Z'))).toBe(true);
  });

  it('does not mark a mid-afternoon request as after hours', () => {
    // 18:30 UTC = 2:30 PM EDT
    expect(isAfterHours(new Date('2025-09-16T18:30:00Z'))).toBe(false);
  });

  it('handles the window wrapping past midnight', () => {
    // 23:00 UTC = 7:00 PM EDT — after hours
    expect(isAfterHours(new Date('2025-09-16T23:00:00Z'))).toBe(true);
    // 13:00 UTC = 9:00 AM EDT — working hours
    expect(isAfterHours(new Date('2025-09-16T13:00:00Z'))).toBe(false);
  });

  it('treats the boundary hours consistently', () => {
    // 22:00 UTC = 6:00 PM EDT — the first after-hours hour
    expect(isAfterHours(new Date('2025-09-16T22:00:00Z'))).toBe(true);
    // 11:00 UTC = 7:00 AM EDT — the first working hour
    expect(isAfterHours(new Date('2025-09-16T11:00:00Z'))).toBe(false);
  });

  it('does not use UK time — a 2 AM Eastern request is 7 AM in the UK', () => {
    const instant = new Date('2025-09-16T06:00:00Z');
    // In London this is 07:00, which would NOT be after hours on a UK clock.
    expect(instant.toISOString()).toBe('2025-09-16T06:00:00.000Z');
    expect(isAfterHours(instant)).toBe(true);
  });
});
