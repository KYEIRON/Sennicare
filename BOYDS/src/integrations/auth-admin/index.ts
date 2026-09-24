import 'server-only';

import { readEnv } from '@/lib/env';
import { createSupabaseAuthAdmin } from './supabase-auth-admin';
import { unavailableAuthAdmin } from './unavailable-auth-admin';
import type { AuthAdminProvider } from './types';

/** Live when the URL and the service role key are both configured. */
export function getAuthAdmin(): AuthAdminProvider {
  const env = readEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return unavailableAuthAdmin;
  }
  return createSupabaseAuthAdmin(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export * from './types';
