import { domainError, err } from '@/lib/result';
import type { AuthAdminProvider } from './types';

const UNAVAILABLE = () =>
  err(
    domainError(
      'auth-admin/unavailable',
      'Invitations are not available: the server has no Supabase service role key configured. The person has been saved; send the invitation once the key is set.',
    ),
  );

/** No service role key: nothing is sent, and nothing pretends it was. */
export const unavailableAuthAdmin: AuthAdminProvider = {
  name: 'unavailable',
  available: false,
  invite: async () => UNAVAILABLE(),
  sendPasswordSetup: async () => UNAVAILABLE(),
  setSignInBlocked: async () => UNAVAILABLE(),
};
