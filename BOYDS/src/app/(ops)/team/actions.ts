'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { readEnv } from '@/lib/env';
import { getAuthAdmin } from '@/integrations/auth-admin';
import { getTeamMember, linkSignIn, updatePerson } from '@/database/team';
import {
  inviteTeamMember,
  INVITE_OUTCOME_MESSAGES,
  type InviteOutcome,
} from '@/services/team/invite';
import { reactivationStatus } from '@/services/team/state';
import {
  addEmailSchema,
  addPersonSchema,
  changeRoleSchema,
  personIdSchema,
} from '@/validation/team';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Managing people. Every action here:
 *   1. requires the `users.manage` capability — ADMIN only (src/lib/permissions.ts);
 *   2. writes through the acting admin's OWN session, so row level security —
 *      which also allows only an ADMIN (migration 0027) — has the final say,
 *      and the audit trail records who did it;
 *   3. reports only what actually happened.
 *
 * The service role key is touched only inside the auth admin adapter, and only
 * to create or manage sign-in accounts.
 */

const DENIED: FormState = { error: 'Only an admin can manage the team.' };

function confirmUrl(): string {
  const site = readEnv().NEXT_PUBLIC_SITE_URL ?? '';
  return `${site}/auth/confirm`;
}

function describe(outcome: InviteOutcome): FormState {
  if (outcome.kind === 'FAILED') return { error: outcome.message };
  const message = INVITE_OUTCOME_MESSAGES[outcome.kind];
  return outcome.kind === 'UNAVAILABLE' ? { error: message } : { success: message };
}

async function invite(personId: string): Promise<FormState> {
  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const person = await getTeamMember(supabase, personId);
  if (!person) return { error: 'That person could not be found.' };

  const outcome = await inviteTeamMember({
    person: { id: person.id, email: person.email, hasSignIn: person.hasSignIn },
    provider: getAuthAdmin(),
    redirectTo: confirmUrl(),
    link: (id, authUserId) => linkSignIn(supabase, id, authUserId),
  });

  revalidatePath('/team');
  return describe(outcome);
}

/** Add a person — with or without an email — and invite them if asked. */
export async function addPerson(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) return DENIED;

  const parsed = addPersonSchema.safeParse({
    firstName: formData.get('firstName') ?? '',
    lastName: formData.get('lastName') ?? '',
    email: formData.get('email') ?? '',
    role: formData.get('role'),
    isPartner: formData.get('isPartner') === 'on',
    partnerTitle: formData.get('partnerTitle') ?? '',
    isDriver: formData.get('isDriver') === 'on',
    sendInvitation: formData.get('sendInvitation') === 'on',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { data: personId, error } = await supabase.rpc('add_team_member', {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_partner_title: parsed.data.isPartner ? parsed.data.partnerTitle : null,
    p_is_driver: parsed.data.isDriver,
  });

  if (error || typeof personId !== 'string') {
    return {
      error: error?.message.includes('duplicate')
        ? 'Someone on the team already has that email address.'
        : 'Could not add that person.',
    };
  }

  revalidatePath('/team');

  if (!parsed.data.email) return { success: INVITE_OUTCOME_MESSAGES.NO_EMAIL };
  if (!parsed.data.sendInvitation) {
    return { success: 'Saved. Send the invitation from the list when you are ready.' };
  }
  return invite(personId);
}

/** Send, or re-send, an invitation. For someone already signed up, a password link. */
export async function sendInvitation(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) return DENIED;

  const personId = personIdSchema.safeParse(formData.get('personId'));
  if (!personId.success) return { error: 'That person could not be found.' };
  return invite(personId.data);
}

/** Add the email of someone recorded without one — Moh's case — and invite them. */
export async function addEmail(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) return DENIED;

  const parsed = addEmailSchema.safeParse({
    personId: formData.get('personId'),
    email: formData.get('email') ?? '',
    sendInvitation: formData.get('sendInvitation') === 'on',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const saved = await updatePerson(supabase, parsed.data.personId, {
    email: parsed.data.email,
  });
  if (!saved.ok) {
    return {
      error: saved.error.message.includes('could not be saved')
        ? 'Could not save that email. Someone on the team may already have it.'
        : saved.error.message,
    };
  }

  revalidatePath('/team');
  return parsed.data.sendInvitation
    ? invite(parsed.data.personId)
    : { success: 'Email saved. Send the invitation when you are ready.' };
}

export async function changeRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) return DENIED;

  const parsed = changeRoleSchema.safeParse({
    personId: formData.get('personId'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const saved = await updatePerson(supabase, parsed.data.personId, {
    role: parsed.data.role,
  });
  if (!saved.ok) return { error: saved.error.message };

  revalidatePath('/team');
  return { success: 'Role changed. It takes effect on their next page load.' };
}

/**
 * Deactivate. Every permission is removed at the database the moment this
 * saves, because only ACTIVE people resolve in row level security. Blocking
 * the sign-in account as well stops them getting a fresh session; if that part
 * is unavailable, the database block still holds, and the message says so.
 */
export async function deactivate(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) return DENIED;

  const personId = personIdSchema.safeParse(formData.get('personId'));
  if (!personId.success) return { error: 'That person could not be found.' };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const person = await getTeamMember(supabase, personId.data);
  if (!person) return { error: 'That person could not be found.' };

  const saved = await updatePerson(supabase, person.id, { status: 'INACTIVE' });
  if (!saved.ok) return { error: saved.error.message };

  revalidatePath('/team');

  if (person.authUserId) {
    const blocked = await getAuthAdmin().setSignInBlocked(person.authUserId, true);
    if (!blocked.ok) {
      return {
        success:
          'Deactivated: they can no longer see or change anything. (Their sign-in account could not also be blocked — the service role key is not configured — but the database refuses them regardless.)',
      };
    }
  }
  return { success: 'Deactivated. They can no longer sign in or see anything.' };
}

export async function reactivate(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) return DENIED;

  const personId = personIdSchema.safeParse(formData.get('personId'));
  if (!personId.success) return { error: 'That person could not be found.' };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const person = await getTeamMember(supabase, personId.data);
  if (!person) return { error: 'That person could not be found.' };

  const status = reactivationStatus(person);
  const saved = await updatePerson(supabase, person.id, { status });
  if (!saved.ok) return { error: saved.error.message };

  if (person.authUserId) await getAuthAdmin().setSignInBlocked(person.authUserId, false);

  revalidatePath('/team');
  return {
    success:
      status === 'ACTIVE'
        ? 'Reactivated. They can sign in again.'
        : 'Reactivated. They have not signed in yet, so they are back to waiting on their invitation.',
  };
}

/** Give an existing person a driver record — e.g. a partner who starts driving. */
export async function addDriverRecord(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) return DENIED;

  const personId = personIdSchema.safeParse(formData.get('personId'));
  if (!personId.success) return { error: 'That person could not be found.' };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('drivers').insert({ user_id: personId.data });
  if (error) {
    return {
      error: error.message.includes('duplicate')
        ? 'They already have a driver record.'
        : 'Could not add a driver record.',
    };
  }

  revalidatePath('/team');
  revalidatePath('/drivers');
  return {
    success:
      'Driver record added. To use the driver app they also need the Driver role; a partner or admin who drives keeps the operations screens.',
  };
}
