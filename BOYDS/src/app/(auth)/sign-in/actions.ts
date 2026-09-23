'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerClient } from '@/lib/supabase/server';
import { RATE_LIMITS, callerIdentifier, checkRateLimit } from '@/lib/rate-limit';
import { signInSchema } from '@/validation/auth';
import { homeRouteFor } from '@/lib/permissions';
import { readEnv } from '@/lib/env';
import type { UserRole } from '@/types/auth';

export interface SignInState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string[]>>;
}

/**
 * Sign in.
 *
 * Failure messages are deliberately uniform: "Those sign-in details were not
 * recognised" for a wrong password, an unknown address, or an address that
 * exists but has no BOYD'S record. Distinguishing them would let anyone confirm
 * whether a given email has an account here.
 */
export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  // Slows password guessing. The message deliberately does not reveal whether
  // any of the attempts were close.
  const limit = checkRateLimit(
    RATE_LIMITS.SIGN_IN,
    callerIdentifier(await headers()),
    'sign-in',
  );

  if (!limit.allowed) {
    return {
      error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return {
      error: 'Sign-in is not available yet: the BOYD’S database has not been connected.',
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: 'Those sign-in details were not recognised.' };
  }

  // Activates an invited account on its first sign-in, stamps the sign-in
  // time, and never reactivates a deactivated or suspended one — that is an
  // admin's decision (migration 0027).
  const { data: rows } = await supabase.rpc('record_my_sign_in');
  const row = (rows as { role: UserRole; status: string }[] | null)?.[0];

  // An auth account with no BOYD'S user record has no role and no access.
  // Accounts are provisioned by an admin, never created implicitly.
  if (!row) {
    await supabase.auth.signOut();
    return { error: 'Those sign-in details were not recognised.' };
  }

  if (row.status !== 'ACTIVE') {
    await supabase.auth.signOut();
    return {
      error: 'This account is not active. Ask a BOYD’S admin to reactivate it.',
    };
  }

  redirect(homeRouteFor(row.role));
}

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/sign-in');
}

export interface ResetState {
  readonly sent?: boolean;
  readonly error?: string;
}

/**
 * "Forgot your password?"
 *
 * The answer is the same whether or not the address has an account, so this
 * cannot be used to find out who works at BOYD'S. Rate-limited like sign-in.
 */
export async function requestPasswordReset(
  _previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const limit = checkRateLimit(
    RATE_LIMITS.SIGN_IN,
    callerIdentifier(await headers()),
    'password-reset',
  );
  if (!limit.allowed) {
    return { error: 'Too many requests. Please wait a few minutes and try again.' };
  }

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'Enter the email address you sign in with.' };
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return {
      error: 'This is not available yet: the BOYD’S database has not been connected.',
    };
  }

  const site = readEnv().NEXT_PUBLIC_SITE_URL ?? '';
  // The result is deliberately ignored: success and "no such account" must be
  // indistinguishable to the person asking.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/confirm`,
  });

  return { sent: true };
}
