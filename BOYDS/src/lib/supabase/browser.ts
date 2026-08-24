/**
 * The browser Supabase client.
 *
 * Only the anon key ever reaches the browser. The service role key is
 * server-only and is never exposed here — it carries no NEXT_PUBLIC_ prefix, so
 * Next.js will not bundle it even by accident.
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
