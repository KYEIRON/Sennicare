/**
 * Dates and times for BOYD'S.
 *
 * Stored in UTC, displayed in America/New_York. BOYD'S operates in North
 * Carolina; Ronald managing the business from the United Kingdom does not make
 * any part of the business run on UK time.
 */

import { TIME_ZONE, LOCALE } from './format';

/** "Tuesday, May 20, 2025" in BOYD'S operating time zone. */
export function formatOperatingDate(instant: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(instant);
}

/** "2:30 PM EDT" in BOYD'S operating time zone. */
export function formatOperatingTime(instant: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(instant);
}

/** The hour (0-23) of an instant in BOYD'S operating time zone. */
export function operatingHour(instant: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    hour12: false,
  }).format(instant);
  // Intl renders midnight as "24" in some engines; normalise it.
  return Number(hour) % 24;
}

/** "2025-05-20" — the calendar date in BOYD'S operating time zone. */
export function operatingDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Whether an instant falls in BOYD'S after-hours window, in operating time.
 *
 * A request arriving at 02:00 Eastern is AFTER_HOURS regardless of where the
 * customer or either partner happens to be. Windows that wrap past midnight are
 * handled — the default window does exactly that.
 *
 * @param startHour first hour of the window, inclusive (default 18:00)
 * @param endHour   first hour outside the window (default 07:00)
 */
export function isAfterHours(instant: Date, startHour = 18, endHour = 7): boolean {
  const hour = operatingHour(instant);
  return startHour > endHour
    ? hour >= startHour || hour < endHour
    : hour >= startHour && hour < endHour;
}
