/**
 * User repository — the only place user queries are written.
 *
 * Repositories use the caller's session-bound client, so every query here is
 * subject to row level security. A bug in this file cannot read past a policy.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, Partner, UserRole } from '@/types/auth';
import { err, ok, domainError, type Result } from '@/lib/result';

interface UserRow {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  role: string;
  status: string;
}

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role as UserRole,
    status: row.status as AppUser['status'],
  };
}

const USER_COLUMNS = 'id, auth_user_id, email, first_name, last_name, role, status';

export async function findUserByAuthId(
  client: SupabaseClient,
  authUserId: string,
): Promise<Result<AppUser | null>> {
  const { data, error } = await client
    .from('users')
    .select(USER_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    return err(domainError('db/query-failed', 'Could not read the user record.'));
  }
  return ok(data ? toAppUser(data as UserRow) : null);
}

export async function listUsers(client: SupabaseClient): Promise<Result<AppUser[]>> {
  const { data, error } = await client
    .from('users')
    .select(USER_COLUMNS)
    .order('first_name');

  if (error) {
    return err(domainError('db/query-failed', 'Could not list users.'));
  }
  return ok((data as UserRow[]).map(toAppUser));
}

export async function recordSignIn(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  // Best effort. A failure to stamp the sign-in time must never block sign-in.
  await client
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
}

interface PartnerRow {
  id: string;
  user_id: string;
  name: string;
  role_title: string;
  responsibilities: string[];
  active: boolean;
}

export async function listPartners(client: SupabaseClient): Promise<Result<Partner[]>> {
  const { data, error } = await client
    .from('partners')
    .select('id, user_id, name, role_title, responsibilities, active')
    .order('name');

  if (error) {
    return err(domainError('db/query-failed', 'Could not list partners.'));
  }

  return ok(
    (data as PartnerRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      roleTitle: row.role_title,
      responsibilities: row.responsibilities,
      active: row.active,
    })),
  );
}
