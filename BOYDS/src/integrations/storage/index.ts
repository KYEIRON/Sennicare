import 'server-only';

import { getServerClient } from '@/lib/supabase/server';
import { createSupabaseStorage } from './supabase-storage';
import { unavailableStorage } from './unavailable-storage';
import type { StorageProvider } from './types';

/**
 * Select the storage provider.
 *
 * One decision, made here: live when the database is configured, explicitly
 * unavailable when it is not. Nothing downstream knows which it has, and there
 * is no adapter that simulates storage in a running application.
 */
export async function getStorage(): Promise<StorageProvider> {
  const client = await getServerClient();
  return client ? createSupabaseStorage(client) : unavailableStorage;
}

export * from './types';
