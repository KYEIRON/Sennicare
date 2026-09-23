import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

/**
 * A standing guard on a build setting that production depends on.
 *
 * With Turbopack's scope hoisting on, Next 16.3.6 compiled the Settings page to
 * reference `unavailableMaps`, `unavailableEmail` and `unavailableSms` without
 * their declarations, and /settings failed in production (D-052). Only a
 * signed-in partner reaches that page, so neither the browser suite (signed
 * out) nor the unit tests could notice the setting being removed.
 */
describe('next.config', () => {
  it('keeps Turbopack scope hoisting off', () => {
    expect(
      nextConfig.experimental?.turbopackScopeHoisting,
      'Removing this needs /settings shown to render for a signed-in partner on a production build (D-052).',
    ).toBe(false);
  });
});
