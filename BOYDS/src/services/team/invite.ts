/**
 * Inviting a person: create their sign-in account, link it to their record.
 *
 * The sign-in account is created through the auth admin adapter; the link is
 * written through the acting admin's own session (the `link` function passed
 * in), so row level security and the audit trail govern the part that matters.
 *
 * Pure orchestration with its dependencies passed in, so every outcome is
 * unit-tested with a fake adapter — including the ones that should never
 * happen quietly: no key configured, and an account that belongs to someone
 * else.
 */

import type { AuthAdminProvider } from '@/integrations/auth-admin/types';
import type { Result } from '@/lib/result';

export type InviteOutcome =
  | { readonly kind: 'SENT' }
  | { readonly kind: 'LINKED_EXISTING' }
  | { readonly kind: 'RESENT' }
  | { readonly kind: 'NO_EMAIL' }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'FAILED'; readonly message: string };

export interface InvitePerson {
  readonly id: string;
  readonly email: string | null;
  readonly hasSignIn: boolean;
}

export async function inviteTeamMember(input: {
  readonly person: InvitePerson;
  readonly provider: AuthAdminProvider;
  readonly redirectTo: string;
  /** Link a sign-in account to the person's record, as the acting admin. */
  readonly link: (personId: string, authUserId: string) => Promise<Result<void>>;
}): Promise<InviteOutcome> {
  const { person, provider, redirectTo, link } = input;

  if (!person.email) return { kind: 'NO_EMAIL' };
  if (!provider.available) return { kind: 'UNAVAILABLE' };

  // Already linked: the account exists, so "invite" means "send the link to
  // set a password" again. A second account is never created.
  if (person.hasSignIn) {
    const resent = await provider.sendPasswordSetup(person.email, redirectTo);
    return resent.ok
      ? { kind: 'RESENT' }
      : { kind: 'FAILED', message: resent.error.message };
  }

  const invited = await provider.invite(person.email, redirectTo);
  if (!invited.ok) return { kind: 'FAILED', message: invited.error.message };

  const linked = await link(person.id, invited.value.authUserId);
  if (!linked.ok) {
    // The most likely cause is that this sign-in account is already linked to
    // a different person — the database allows each account one person only.
    return {
      kind: 'FAILED',
      message:
        'The sign-in account was created but could not be linked. It may already belong to someone else on the team.',
    };
  }

  return invited.value.alreadyExisted ? { kind: 'LINKED_EXISTING' } : { kind: 'SENT' };
}

export const INVITE_OUTCOME_MESSAGES: Readonly<
  Record<Exclude<InviteOutcome['kind'], 'FAILED'>, string>
> = {
  SENT: 'Invitation sent. They will get an email with a link to set their password.',
  LINKED_EXISTING:
    'That email already had a sign-in account, so it has been linked instead. They can sign in with their existing password, or use "Forgot your password?".',
  RESENT: 'A fresh link to set their password has been emailed.',
  NO_EMAIL:
    'Saved. Add their email when you have it, and the invitation can be sent then.',
  UNAVAILABLE:
    'Saved, but no invitation was sent: the server has no Supabase service role key configured. Send it once the key is set.',
};
