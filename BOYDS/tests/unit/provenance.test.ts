import { describe, expect, it } from 'vitest';
import {
  DEMO_DATA_LABEL,
  DemoDataInRealContextError,
  assertReal,
  combineProvenance,
  demo,
  isDemo,
  isReal,
  real,
  requiresDemoLabel,
} from '@/lib/provenance';
import { formatProvenanced, formatCents } from '@/lib/format';
import { cents } from '@/types/branded';

/**
 * The dashboard mockup is a VISUAL DESIGN REFERENCE ONLY. These tests enforce
 * that its illustrative figures — or any others — can never be presented as real
 * BOYD'S operational data.
 */
describe('data provenance', () => {
  it('marks real data as real', () => {
    const v = real(cents(50_000));
    expect(isReal(v)).toBe(true);
    expect(isDemo(v)).toBe(false);
    expect(requiresDemoLabel(v)).toBe(false);
  });

  it('marks illustrative data as demo and requires its label', () => {
    const v = demo(cents(124_000), 'dashboard layout preview before real jobs exist');
    expect(isDemo(v)).toBe(true);
    expect(isReal(v)).toBe(false);
    expect(requiresDemoLabel(v)).toBe(true);
  });

  it('requires a reason for every piece of illustrative data', () => {
    const v = demo(cents(124_000), 'dashboard layout preview');
    expect(v.reason).toBe('dashboard layout preview');
  });

  it('ALWAYS labels illustrative data at the display edge', () => {
    const shown = formatProvenanced(
      demo(cents(124_000), 'dashboard layout preview'),
      formatCents,
    );
    expect(shown.needsBadge).toBe(true);
    expect(shown.detail).toContain(DEMO_DATA_LABEL);
  });

  it('does not badge real data', () => {
    const shown = formatProvenanced(real(cents(50_000)), formatCents);
    expect(shown).toEqual({ text: '$500.00', status: 'OK', needsBadge: false });
  });

  it('treats any illustrative input as making the whole result illustrative', () => {
    expect(combineProvenance(['REAL', 'REAL'])).toBe('REAL');
    expect(combineProvenance(['REAL', 'DEMO'])).toBe('DEMO');
    expect(combineProvenance(['DEMO'])).toBe('DEMO');
  });

  it('an empty set is real — nothing illustrative went into it', () => {
    expect(combineProvenance([])).toBe('REAL');
  });
});

describe('assertReal — guarding business calculations', () => {
  it('lets real data through', () => {
    expect(assertReal(real(cents(50_000)), 'invoice total')).toBe(50_000);
  });

  it('refuses illustrative data in a real business context', () => {
    expect(() =>
      assertReal(demo(cents(124_000), 'dashboard preview'), 'invoice total'),
    ).toThrow(DemoDataInRealContextError);
  });

  it('names the context so the leak is traceable', () => {
    expect(() =>
      assertReal(
        demo(cents(124_000), 'dashboard preview'),
        'monthly contribution report',
      ),
    ).toThrow(/monthly contribution report/);
  });
});
