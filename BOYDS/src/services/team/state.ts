/**
 * Where a person stands, and what an admin can do next.
 *
 * Pure: derived from the person's record alone, so every screen and every
 * action agrees, and the rules are unit-tested rather than scattered through
 * a page. The database enforces the same rules again (migration 0027); this is
 * what makes the screen offer only the actions that will succeed.
 */

import type { UserRole, UserStatus } from '@/types/auth';

export interface TeamMemberRecord {
  readonly id: string;
  readonly email: string | null;
  readonly role: UserRole;
  readonly status: UserStatus;
  /** Whether a sign-in account is linked. */
  readonly hasSignIn: boolean;
  readonly lastLoginAt: string | null;
}

export type TeamMemberState =
  /** Recorded, but no email yet — nothing can be sent. */
  | 'WAITING_FOR_EMAIL'
  /** Has an email, no sign-in account yet: the invitation has not gone. */
  | 'NOT_INVITED'
  /** Invitation sent; they have not signed in yet. */
  | 'INVITED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export function teamMemberState(person: TeamMemberRecord): TeamMemberState {
  if (person.status === 'INACTIVE') return 'DEACTIVATED';
  if (person.status === 'SUSPENDED') return 'SUSPENDED';
  if (person.status === 'ACTIVE') return 'ACTIVE';
  if (!person.email) return 'WAITING_FOR_EMAIL';
  if (!person.hasSignIn) return 'NOT_INVITED';
  return 'INVITED';
}

export const TEAM_STATE_LABELS: Readonly<Record<TeamMemberState, string>> = {
  WAITING_FOR_EMAIL: 'Waiting for email',
  NOT_INVITED: 'Not invited yet',
  INVITED: 'Invitation sent',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};

export type TeamAction =
  | 'ADD_EMAIL'
  | 'SEND_INVITATION'
  | 'RESEND_INVITATION'
  | 'SEND_PASSWORD_RESET'
  | 'CHANGE_ROLE'
  | 'DEACTIVATE'
  | 'REACTIVATE';

/**
 * The actions that make sense for this person, as seen by this admin.
 *
 * An admin never gets role or status actions on their own row: the database
 * refuses a person changing their own role or status, and offering a button
 * that is certain to fail would be worse than not offering it.
 */
export function availableActions(
  person: TeamMemberRecord,
  actingUserId: string,
): readonly TeamAction[] {
  const state = teamMemberState(person);
  const self = person.id === actingUserId;
  const actions: TeamAction[] = [];

  switch (state) {
    case 'WAITING_FOR_EMAIL':
      actions.push('ADD_EMAIL');
      break;
    case 'NOT_INVITED':
      actions.push('SEND_INVITATION');
      break;
    case 'INVITED':
      actions.push('RESEND_INVITATION');
      break;
    case 'ACTIVE':
      actions.push('SEND_PASSWORD_RESET');
      break;
    case 'SUSPENDED':
    case 'DEACTIVATED':
      break;
  }

  if (!self) {
    actions.push('CHANGE_ROLE');
    if (state === 'SUSPENDED' || state === 'DEACTIVATED') actions.push('REACTIVATE');
    else actions.push('DEACTIVATE');
  }

  return actions;
}

/**
 * The status a reactivated person returns to.
 *
 * ACTIVE only if they have a sign-in account AND have signed in before. A
 * person deactivated before they ever signed in goes back to waiting on their
 * invitation — ACTIVE would claim an account nobody has used, and the database
 * refuses ACTIVE without a sign-in account at all.
 */
export function reactivationStatus(person: TeamMemberRecord): UserStatus {
  return person.hasSignIn && person.lastLoginAt !== null ? 'ACTIVE' : 'INVITED';
}

/** Plain-English description of each role, for the screen that assigns it. */
export const ROLE_DESCRIPTIONS: Readonly<Record<UserRole, string>> = {
  ADMIN:
    'Everything a partner can do, plus managing people: inviting, changing roles, deactivating.',
  PARTNER:
    'Runs the business: jobs, customers, dispatch, quotes, invoices, reports and settings. Cannot manage people.',
  DRIVER:
    'The driver app only: their own assigned jobs, mileage, fuel, expenses, proof of delivery. No prices, costs or customer lists.',
};
