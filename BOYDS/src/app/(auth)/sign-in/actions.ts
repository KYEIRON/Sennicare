'use server';

import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase/server';
import { signInSchema } from '@/validation/auth';
import { homeRouteFor } from '@/lib/permissions';
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

  const { data: row } = await supabase
    .from('users')
    .select('id, role, status')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  // An auth account with no BOYD'S user record has no role and no access.
  // Accounts are provisioned by a partner, never created implicitly.
  if (!row) {
    await supabase.auth.signOut();
    return { error: 'Those sign-in details were not recognised.' };
  }

  if (row.status !== 'ACTIVE') {
    await supabase.auth.signOut();
    return {
      error: 'This account is not active. Ask a BOYD’S partner to reactivate it.',
    };
  }

  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', row.id);

  redirect(homeRouteFor(row.role as UserRole));
}

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/sign-in');
}
