import { describe, expect, it } from 'vitest';
import {
  BUSINESS_SETTINGS,
  configured,
  fromNullable,
  isConfigured,
  notConfigured,
  requireConfigured,
} from '@/lib/configured';
import { cents } from '@/types/branded';

describe('Configured — undecided business policy', () => {
  it('reads a stored value as configured', () => {
    const policy = fromNullable(BUSINESS_SETTINGS.TARGET_CONTRIBUTION_MARGIN, 2000);
    expect(isConfigured(policy)).toBe(true);
  });

  it.each([null, undefined])('reads %p as NOT_CONFIGURED', (stored) => {
    const policy = fromNullable(
      BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_JOB,
      stored as number | null,
    );
    expect(policy.status).toBe('NOT_CONFIGURED');
    expect(isConfigured(policy)).toBe(false);
  });

  it('treats a configured zero as a real decision, not an absent one', () => {
    // Zero is a legitimate policy value. Only null and undefined mean undecided.
    const policy = fromNullable(BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_JOB, cents(0));
    expect(policy.status).toBe('CONFIGURED');
  });

  it('stops a calculation that depends on an undecided policy', () => {
    const result = requireConfigured(
      notConfigured<number>(BUSINESS_SETTINGS.TARGET_CONTRIBUTION_MARGIN),
    );
    expect(result).toEqual({
      status: 'NOT_CONFIGURED',
      setting: 'target_contribution_margin',
    });
  });

  it('lets a calculation proceed on a decided policy', () => {
    const result = requireConfigured(
      configured(BUSINESS_SETTINGS.TARGET_CONTRIBUTION_MARGIN, 2000),
    );
    expect(result).toEqual({ status: 'OK', value: 2000 });
  });

  it('names every open BOYD’S business decision', () => {
    // Guards against a setting being silently dropped and defaulted somewhere.
    expect(Object.values(BUSINESS_SETTINGS)).toEqual([
      'minimum_contribution_per_job',
      'minimum_contribution_per_mile',
      'target_contribution_margin',
      'driver_labour_cost_basis',
      'vehicle_cost_allocation_basis',
      'service_area_radius',
      'medical_courier_limits',
      'default_payment_terms',
      'quote_validity_period',
      'auto_acceptance_thresholds',
    ]);
  });
});
