/**
 * Supabase clients bound to the caller's session.
 *
 * Every ordinary read and write uses the caller's session, so Postgres row
 * level security applies to it. This is what makes RLS the last line of
 * defence rather than a decoration: even a bug in application code cannot read
 * rows the signed-in user's policies forbid.
 */

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { readEnv, isDatabaseConfigured } from '@/lib/env';

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'The database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
    this.name = 'DatabaseNotConfiguredError';
  }
}

/**
 * The session-bound client for server components and server actions.
 *
 * Returns null when the database is not configured, so callers render an
 * explicit unavailable state rather than crashing or, worse, appearing to work.
 */
export async function getServerClient(): Promise<SupabaseClient | null> {
  const env = readEnv();
  if (!isDatabaseConfigured(env)) return null;

  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot set cookies. Session refresh happens in
            // middleware, which can, so this is safe to ignore here.
          }
        },
      },
    },
  );
}

/** As above, but throws when unconfigured — for paths that cannot proceed. */
export async function requireServerClient(): Promise<SupabaseClient> {
  const client = await getServerClient();
  if (!client) throw new DatabaseNotConfiguredError();
  return client;
}
