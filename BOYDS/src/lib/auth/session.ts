/**
 * Server-side authorisation guards.
 *
 * Every server action and route handler in BOYD'S starts with one of these.
 * They are the second enforcement layer; Postgres row level security is the
 * first and authoritative one, and hidden UI is the third and weakest.
 *
 * These functions live on the server only. A guard that can be reached from the
 * browser is not a guard.
 */

import 'server-only';

import { getServerClient } from '@/lib/supabase/server';
import { can, type Capability } from '@/lib/permissions';
import type { AppUser, UserRole } from '@/types/auth';
import { err, ok, domainError, type Result } from '@/lib/result';

export const AUTH_ERRORS = {
  NOT_CONFIGURED: 'auth/not-configured',
  NOT_SIGNED_IN: 'auth/not-signed-in',
  NO_APP_USER: 'auth/no-app-user',
  NOT_ACTIVE: 'auth/not-active',
  FORBIDDEN: 'auth/forbidden',
} as const;

/**
 * The signed-in BOYD'S user, or a reason there is not one.
 *
 * Every failure mode is distinct, because they need different responses: an
 * unconfigured database is an operator problem, a missing session sends the
 * visitor to sign in, and a suspended account must say so rather than silently
 * behaving like a signed-out one.
 */
export async function getCurrentUser(): Promise<Result<AppUser>> {
  const supabase = await getServerClient();
  if (!supabase) {
    return err(
      domainError(AUTH_ERRORS.NOT_CONFIGURED, 'The database is not configured.'),
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return err(domainError(AUTH_ERRORS.NOT_SIGNED_IN, 'No signed-in session.'));
  }

  const { data: row, error: rowError } = await supabase
    .from('users')
    .select('id, auth_user_id, email, first_name, last_name, role, status')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (rowError || !row) {
    // A Supabase Auth account with no BOYD'S user row has no role and therefore
    // no access. Accounts are provisioned deliberately by a partner, never
    // created implicitly by someone managing to sign up.
    return err(
      domainError(
        AUTH_ERRORS.NO_APP_USER,
        'This sign-in is not linked to a BOYD’S user record.',
      ),
    );
  }

  if (row.status !== 'ACTIVE') {
    return err(
      domainError(AUTH_ERRORS.NOT_ACTIVE, 'This account is not active.', {
        status: row.status,
      }),
    );
  }

  return ok({
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role as UserRole,
    status: row.status,
  });
}

/** Require any active signed-in user. */
export async function requireUser(): Promise<Result<AppUser>> {
  return getCurrentUser();
}

/** Require a specific capability. The general form the others build on. */
export async function requireCapability(
  capability: Capability,
): Promise<Result<AppUser>> {
  const current = await getCurrentUser();
  if (!current.ok) return current;

  if (!can(current.value.role, capability)) {
    return err(
      domainError(AUTH_ERRORS.FORBIDDEN, 'You do not have access to this.', {
        required: capability,
        role: current.value.role,
      }),
    );
  }

  return current;
}

/** Require a partner (or admin). */
export async function requirePartner(): Promise<Result<AppUser>> {
  const current = await getCurrentUser();
  if (!current.ok) return current;

  if (current.value.role !== 'PARTNER' && current.value.role !== 'ADMIN') {
    return err(
      domainError(AUTH_ERRORS.FORBIDDEN, 'This area is for BOYD’S partners.', {
        role: current.value.role,
      }),
    );
  }

  return current;
}

/** Require a driver. */
export async function requireDriver(): Promise<Result<AppUser>> {
  const current = await getCurrentUser();
  if (!current.ok) return current;

  if (current.value.role !== 'DRIVER') {
    return err(
      domainError(AUTH_ERRORS.FORBIDDEN, 'This area is for the driver app.', {
        role: current.value.role,
      }),
    );
  }

  return current;
}
