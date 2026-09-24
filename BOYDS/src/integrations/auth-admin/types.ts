/**
 * Managing sign-in accounts: the Supabase Auth admin API.
 *
 * This is the ONLY thing the service role key is used for. It creates and
 * manages sign-in accounts; it never reads or writes BOYD'S data. People,
 * roles and statuses are written through the acting admin's own session, so
 * row level security still decides, and the audit trail still records who.
 *
 * Three adapters, as with every integration: live, unavailable (no key
 * configured — invitations report that plainly and send nothing), and a fake
 * used only by tests.
 */

import type { Result } from '@/lib/result';

export interface InviteResult {
  /** The sign-in account's id, to link to the person's record. */
  readonly authUserId: string;
  /**
   * True when a sign-in account already existed for this email — created in
   * the Supabase dashboard, say. It is linked rather than duplicated, and no
   * invitation email is sent; the person signs in with their existing password
   * or uses "forgot password".
   */
  readonly alreadyExisted: boolean;
}

export interface AuthAdminProvider {
  readonly name: 'supabase' | 'unavailable' | 'fake';
  readonly available: boolean;

  /** Create a sign-in account and email the person a link to set a password. */
  invite(email: string, redirectTo: string): Promise<Result<InviteResult>>;

  /** Email a link to set a new password. Works for any existing account. */
  sendPasswordSetup(email: string, redirectTo: string): Promise<Result<void>>;

  /**
   * Stop, or allow, a sign-in account signing in at all. Belt and braces:
   * deactivating a person already removes every permission at the database,
   * because only ACTIVE people resolve in row level security. This also stops
   * them obtaining a fresh session.
   */
  setSignInBlocked(authUserId: string, blocked: boolean): Promise<Result<void>>;
}
