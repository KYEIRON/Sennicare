import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { domainError, err, ok, type Result } from '@/lib/result';
import type { UserRole, UserStatus } from '@/types/auth';
import type { TeamMemberRecord } from '@/services/team/state';

export interface TeamMember extends TeamMemberRecord {
  readonly firstName: string;
  readonly lastName: string | null;
  readonly partnerTitle: string | null;
  readonly isDriver: boolean;
  readonly authUserId: string | null;
}

interface Row {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  auth_user_id: string | null;
  last_login_at: string | null;
  partners: { role_title: string }[] | { role_title: string } | null;
  drivers: { id: string }[] | { id: string } | null;
}

function first<T>(value: T[] | T | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Everyone on the team, with their partner and driver records. Row level security decides who may read it. */
export async function listTeam(client: SupabaseClient): Promise<Result<TeamMember[]>> {
  const { data, error } = await client
    .from('users')
    .select(
      'id, first_name, last_name, email, role, status, auth_user_id, last_login_at, partners(role_title), drivers(id)',
    )
    .order('status')
    .order('first_name');

  if (error) return err(domainError('db/query-failed', 'Could not list the team.'));

  return ok(
    (data as unknown as Row[]).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
      status: row.status,
      authUserId: row.auth_user_id,
      hasSignIn: row.auth_user_id !== null,
      lastLoginAt: row.last_login_at,
      partnerTitle: first(row.partners)?.role_title ?? null,
      isDriver: first(row.drivers) !== null,
    })),
  );
}

export async function getTeamMember(
  client: SupabaseClient,
  personId: string,
): Promise<TeamMember | null> {
  const result = await listTeam(client);
  if (!result.ok) return null;
  return result.value.find((person) => person.id === personId) ?? null;
}

/** Link a sign-in account to a person, as the acting admin. */
export async function linkSignIn(
  client: SupabaseClient,
  personId: string,
  authUserId: string,
): Promise<Result<void>> {
  const { data, error } = await client
    .from('users')
    .update({ auth_user_id: authUserId })
    .eq('id', personId)
    .is('auth_user_id', null)
    .select('id');
  // Row level security that blocks an update raises no error — the update just
  // matches nothing. Only a changed row counts as success.
  return error || data?.length !== 1
    ? err(domainError('db/link-failed', 'Could not link the sign-in account.'))
    : ok(undefined);
}

/**
 * Update one person, and report honestly whether it happened.
 *
 * The guardrails in migration 0027 raise plain-English messages ("This is the
 * last active admin…"); those are passed through. Anything else becomes a
 * general failure rather than a raw database error.
 */
export async function updatePerson(
  client: SupabaseClient,
  personId: string,
  changes: Record<string, unknown>,
): Promise<Result<void>> {
  const { data, error } = await client
    .from('users')
    .update(changes)
    .eq('id', personId)
    .select('id');

  if (error) {
    const guardrail = GUARDRAIL_MESSAGES.find((phrase) => error.message.includes(phrase));
    return err(
      domainError(
        'db/update-failed',
        guardrail ? error.message : 'That change could not be saved.',
      ),
    );
  }
  if (data?.length !== 1) {
    return err(
      domainError(
        'db/not-permitted',
        'You do not have permission to change this person.',
      ),
    );
  }
  return ok(undefined);
}

/** The messages migration 0027 raises, which are written to be shown as they are. */
const GUARDRAIL_MESSAGES = [
  'Nobody can change their own role or status',
  'last active admin',
  'cannot be changed or removed',
  'cannot be changed here',
] as const;
