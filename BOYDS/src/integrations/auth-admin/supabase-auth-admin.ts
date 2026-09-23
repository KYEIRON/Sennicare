import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { domainError, err, ok, type Result } from '@/lib/result';
import type { AuthAdminProvider, InviteResult } from './types';

/**
 * The live adapter. Built from the service role key, server-side only.
 *
 * The client it creates never persists or refreshes a session and is never
 * returned to a caller: nothing outside this file can use the key for anything
 * but these three operations.
 */
export function createSupabaseAuthAdmin(
  url: string,
  serviceRoleKey: string,
): AuthAdminProvider {
  const client: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  async function findByEmail(email: string): Promise<string | null> {
    // BOYD'S has a handful of sign-in accounts; a page of 1,000 covers them.
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return null;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    return match?.id ?? null;
  }

  return {
    name: 'supabase',
    available: true,

    async invite(email, redirectTo): Promise<Result<InviteResult>> {
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });

      if (!error && data.user) {
        return ok({ authUserId: data.user.id, alreadyExisted: false });
      }

      // An account already exists for this address. Link it rather than fail:
      // an admin who created the account in the dashboard should not be stuck.
      const existing = await findByEmail(email);
      if (existing) return ok({ authUserId: existing, alreadyExisted: true });

      return err(
        domainError('auth-admin/invite-failed', 'The invitation could not be sent.', {
          reason: error?.message,
        }),
      );
    },

    async sendPasswordSetup(email, redirectTo): Promise<Result<void>> {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      return error
        ? err(domainError('auth-admin/reset-failed', 'The email could not be sent.'))
        : ok(undefined);
    },

    async setSignInBlocked(authUserId, blocked): Promise<Result<void>> {
      const { error } = await client.auth.admin.updateUserById(authUserId, {
        // Supabase has no "ban forever"; a century is the documented approach.
        ban_duration: blocked ? '876000h' : 'none',
      });
      return error
        ? err(domainError('auth-admin/block-failed', 'Could not change sign-in access.'))
        : ok(undefined);
    },
  };
}
