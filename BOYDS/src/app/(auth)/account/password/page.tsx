import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase/server';
import { PasswordForm } from './password-form';

export const metadata: Metadata = { title: 'Set your password' };

/**
 * Setting a password, after following an invitation or reset link.
 *
 * Reachable only with the session that verifying the link created. A person
 * who is deactivated or suspended is turned away here rather than being
 * allowed to set a password for an account they cannot use.
 */
export default async function SetPasswordPage() {
  const supabase = await getServerClient();
  if (!supabase) redirect('/sign-in?reason=not-configured');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/sign-in?reason=link-expired');

  // Readable in any status: the self-select policy does not require ACTIVE.
  const { data: me } = await supabase
    .from('users')
    .select('first_name, status')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  const blocked = !me || me.status === 'SUSPENDED' || me.status === 'INACTIVE';

  return (
    <main className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-[0.25em] text-boyd-orange-500 uppercase">
          BOYD&rsquo;S Logistics LLC
        </p>
        <h1 className="mt-2 text-2xl font-bold text-boyd-light-50">
          {me ? `Welcome, ${me.first_name}` : 'Set your password'}
        </h1>
      </div>

      {blocked ? (
        <p
          role="alert"
          className="rounded-lg border border-boyd-negative/40 bg-boyd-negative/10 p-4 text-sm text-boyd-light-200"
        >
          {me
            ? 'This account is not active. Ask a BOYD’S admin to reactivate it.'
            : 'This sign-in is not linked to anyone on the BOYD’S team. Ask a BOYD’S admin.'}
        </p>
      ) : (
        <>
          <p className="mb-6 text-sm text-boyd-light-300">
            Choose a password. You&rsquo;ll use it with your email address to sign in.
          </p>
          <PasswordForm />
        </>
      )}
    </main>
  );
}
