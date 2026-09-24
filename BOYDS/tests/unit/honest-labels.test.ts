import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DRIVER_AVAILABILITIES, DRIVER_AVAILABILITY_LABELS } from '@/types/operations';

/**
 * Wording that makes a claim must be a claim the system can back.
 * Both of these were found on the live production screens.
 */

describe('driver availability as shown', () => {
  it('never tells anyone a driver is "available" — only that they are not on a job', () => {
    // Nobody declares availability in BOYD'S; AVAILABLE is a default.
    expect(DRIVER_AVAILABILITY_LABELS.AVAILABLE).toBe('Not on a job');
    expect(Object.values(DRIVER_AVAILABILITY_LABELS)).not.toContain('Available');
  });

  it('has a label for every availability value', () => {
    for (const value of DRIVER_AVAILABILITIES) {
      expect(DRIVER_AVAILABILITY_LABELS[value]).toBeTruthy();
    }
  });

  it('is used on every screen that shows availability', () => {
    for (const page of ['command-centre', 'drivers', 'dispatch']) {
      const source = readFileSync(
        join(process.cwd(), 'src', 'app', '(ops)', page, 'page.tsx'),
        'utf8',
      );
      expect(source, page).toContain('DRIVER_AVAILABILITY_LABELS');
      expect(source, page).not.toContain("availability.replace(/_/g, ' ')");
    }
  });
});

describe('the settings screen', () => {
  it('does not claim a database safeguard that does not exist (D-042)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'app', '(ops)', 'settings', 'page.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/disabled at the database/i);
  });
});
