'use server';

import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase/server';
import { newPasswordSchema } from '@/validation/team';
import { homeRouteFor } from '@/lib/permissions';
import type { UserRole } from '@/types/auth';

export interface PasswordState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string[]>>;
}

/**
 * Set a password — the last step of accepting an invitation, and of a reset.
 *
 * Then record_my_sign_in() activates an invited account (and never
 * reactivates a deactivated one), and the person lands where their role
 * belongs.
 */
export async function setPassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get('password') ?? '',
    confirm: formData.get('confirm') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The BOYD’S database has not been connected.' };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return { error: 'Your link has expired. Ask an admin to send a new one.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error: error.message.toLowerCase().includes('different')
        ? 'Choose a password different from your previous one.'
        : 'That password could not be saved. Try a different one.',
    };
  }

  const { data: rows } = await supabase.rpc('record_my_sign_in');
  const me = (rows as { role: UserRole; status: string }[] | null)?.[0];

  if (!me || me.status !== 'ACTIVE') {
    await supabase.auth.signOut();
    return {
      error: me
        ? 'Your password is set, but your account is not active. Ask a BOYD’S admin.'
        : 'This sign-in is not linked to anyone on the BOYD’S team.',
    };
  }

  redirect(homeRouteFor(me.role));
}
