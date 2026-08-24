import { describe, expect, it } from 'vitest';
import {
  capabilityReport,
  isDatabaseConfigured,
  isServiceRoleConfigured,
  readEnv,
} from '@/lib/env';

describe('environment configuration', () => {
  it('treats a missing database as unconfigured rather than throwing', () => {
    expect(isDatabaseConfigured(readEnv({}))).toBe(false);
  });

  it('requires BOTH the URL and the anon key', () => {
    expect(
      isDatabaseConfigured(
        readEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }),
      ),
    ).toBe(false);
    expect(isDatabaseConfigured(readEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key' }))).toBe(
      false,
    );
  });

  it('reports configured when both are present', () => {
    expect(
      isDatabaseConfigured(
        readEnv({
          NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        }),
      ),
    ).toBe(true);
  });

  it('treats a malformed URL as absent, not as a working configuration', () => {
    expect(
      isDatabaseConfigured(
        readEnv({
          NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        }),
      ),
    ).toBe(false);
  });

  it('tracks the service role key separately from the anon key', () => {
    expect(isServiceRoleConfigured(readEnv({}))).toBe(false);
    expect(
      isServiceRoleConfigured(readEnv({ SUPABASE_SERVICE_ROLE_KEY: 'service-key' })),
    ).toBe(true);
  });

  it('reports honestly which capabilities are unavailable and what each needs', () => {
    const report = capabilityReport(readEnv({}));
    expect(report.every((c) => c.available === false)).toBe(true);
    expect(report.every((c) => c.requires.length > 0)).toBe(true);
  });
});
