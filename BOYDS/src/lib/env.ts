/**
 * Environment configuration, validated once at the edge.
 *
 * BOYD'S must never be blocked by a credential it does not yet have. Required
 * variables are validated and their absence is reported honestly; optional
 * integrations simply report themselves UNAVAILABLE and the rest of the system
 * carries on. See docs/INTEGRATIONS.md.
 *
 * Nothing here throws at import time. A missing Supabase URL is a configuration
 * state the application can describe, not a crash on boot.
 */

import { z } from 'zod';

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Read and validate configuration.
 *
 * Takes a plain record rather than NodeJS.ProcessEnv so tests can pass an exact
 * environment — including an empty one — and prove the unconfigured path.
 */
export function readEnv(
  source: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnv {
  const parsed = serverSchema.safeParse(source);
  // An invalid value is treated as absent: the capability reports UNAVAILABLE
  // rather than the application booting with a half-configured client.
  return parsed.success ? parsed.data : {};
}

/**
 * Whether the database and authentication are configured.
 *
 * Both the URL and the anon key are required. One without the other is not a
 * working configuration and must not be treated as one.
 */
export function isDatabaseConfigured(env: ServerEnv = readEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server-only privileged access. Never read in a browser context. */
export function isServiceRoleConfigured(env: ServerEnv = readEnv()): boolean {
  return Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface CapabilityStatus {
  readonly name: string;
  readonly available: boolean;
  /** What Ronald needs to obtain to switch this on. */
  readonly requires: string;
}

/**
 * The capability report shown on the settings page.
 *
 * This is how BOYD'S tells the truth about what is and is not connected,
 * instead of an interface that looks complete and quietly does nothing.
 */
export function capabilityReport(
  env: ServerEnv = readEnv(),
): readonly CapabilityStatus[] {
  return [
    {
      name: 'Database and sign-in',
      available: isDatabaseConfigured(env),
      requires: 'A Supabase project URL and anon key',
    },
    {
      name: 'Privileged server operations',
      available: isServiceRoleConfigured(env),
      requires: 'The Supabase service role key',
    },
  ];
}
