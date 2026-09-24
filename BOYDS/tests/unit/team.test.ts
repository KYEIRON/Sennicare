import { describe, expect, it } from 'vitest';
import { err, ok, domainError } from '@/lib/result';
import type { AuthAdminProvider } from '@/integrations/auth-admin/types';
import { unavailableAuthAdmin } from '@/integrations/auth-admin/unavailable-auth-admin';
import {
  availableActions,
  reactivationStatus,
  teamMemberState,
  type TeamMemberRecord,
} from '@/services/team/state';
import { inviteTeamMember } from '@/services/team/invite';
import { addPersonSchema, newPasswordSchema } from '@/validation/team';

const base: TeamMemberRecord = {
  id: 'person',
  email: 'person@example.test',
  role: 'DRIVER',
  status: 'INVITED',
  hasSignIn: false,
  lastLoginAt: null,
};

describe('where a person stands', () => {
  it('waits for an email when none is known — the Moh case', () => {
    expect(teamMemberState({ ...base, email: null })).toBe('WAITING_FOR_EMAIL');
  });

  it('is not invited yet with an email but no sign-in account', () => {
    expect(teamMemberState(base)).toBe('NOT_INVITED');
  });

  it('is invited once a sign-in account is linked', () => {
    expect(teamMemberState({ ...base, hasSignIn: true })).toBe('INVITED');
  });

  it('reads deactivation and suspension before anything else', () => {
    expect(teamMemberState({ ...base, status: 'INACTIVE' })).toBe('DEACTIVATED');
    expect(teamMemberState({ ...base, status: 'SUSPENDED', email: null })).toBe(
      'SUSPENDED',
    );
  });
});

describe('what an admin is offered', () => {
  it('offers adding an email, not an invitation, when there is no email', () => {
    const actions = availableActions({ ...base, email: null }, 'admin');
    expect(actions).toContain('ADD_EMAIL');
    expect(actions).not.toContain('SEND_INVITATION');
  });

  it('never offers an admin role or status changes on their own record', () => {
    const self = {
      ...base,
      id: 'admin',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      hasSignIn: true,
    };
    const actions = availableActions(self, 'admin');
    expect(actions).not.toContain('CHANGE_ROLE');
    expect(actions).not.toContain('DEACTIVATE');
  });

  it('offers reactivation only to someone deactivated or suspended', () => {
    expect(availableActions({ ...base, status: 'INACTIVE' }, 'admin')).toContain(
      'REACTIVATE',
    );
    expect(
      availableActions({ ...base, status: 'ACTIVE', hasSignIn: true }, 'admin'),
    ).not.toContain('REACTIVATE');
  });
});

describe('reactivation', () => {
  it('returns someone who has signed in before to ACTIVE', () => {
    expect(
      reactivationStatus({ ...base, hasSignIn: true, lastLoginAt: '2026-01-01' }),
    ).toBe('ACTIVE');
  });

  it('returns someone who never signed in to INVITED, not ACTIVE', () => {
    expect(reactivationStatus({ ...base, hasSignIn: true })).toBe('INVITED');
    expect(reactivationStatus(base)).toBe('INVITED');
  });
});

function fakeProvider(overrides: Partial<AuthAdminProvider> = {}): AuthAdminProvider & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    name: 'fake',
    available: true,
    calls,
    invite: async (email) => {
      calls.push(`invite:${email}`);
      return ok({ authUserId: 'auth-new', alreadyExisted: false });
    },
    sendPasswordSetup: async (email) => {
      calls.push(`reset:${email}`);
      return ok(undefined);
    },
    setSignInBlocked: async () => ok(undefined),
    ...overrides,
  };
}

describe('inviting a person', () => {
  const linkOk = async () => ok(undefined);

  it('creates the sign-in account and links it', async () => {
    const provider = fakeProvider();
    const linked: string[] = [];
    const outcome = await inviteTeamMember({
      person: { id: 'p1', email: 'a@example.test', hasSignIn: false },
      provider,
      redirectTo: 'https://example.test/auth/confirm',
      link: async (personId, authUserId) => {
        linked.push(`${personId}->${authUserId}`);
        return ok(undefined);
      },
    });

    expect(outcome).toEqual({ kind: 'SENT' });
    expect(provider.calls).toEqual(['invite:a@example.test']);
    expect(linked).toEqual(['p1->auth-new']);
  });

  it('sends nothing, and says so, when there is no email', async () => {
    const provider = fakeProvider();
    const outcome = await inviteTeamMember({
      person: { id: 'p1', email: null, hasSignIn: false },
      provider,
      redirectTo: 'x',
      link: linkOk,
    });
    expect(outcome).toEqual({ kind: 'NO_EMAIL' });
    expect(provider.calls).toEqual([]);
  });

  it('reports UNAVAILABLE, never success, with no service role key', async () => {
    const outcome = await inviteTeamMember({
      person: { id: 'p1', email: 'a@example.test', hasSignIn: false },
      provider: unavailableAuthAdmin,
      redirectTo: 'x',
      link: linkOk,
    });
    expect(outcome).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('re-sends a password link rather than creating a second account', async () => {
    const provider = fakeProvider();
    const outcome = await inviteTeamMember({
      person: { id: 'p1', email: 'a@example.test', hasSignIn: true },
      provider,
      redirectTo: 'x',
      link: linkOk,
    });
    expect(outcome).toEqual({ kind: 'RESENT' });
    expect(provider.calls).toEqual(['reset:a@example.test']);
  });

  it('links an account that already existed, and says it did', async () => {
    const provider = fakeProvider({
      invite: async () => ok({ authUserId: 'auth-existing', alreadyExisted: true }),
    });
    const outcome = await inviteTeamMember({
      person: { id: 'p1', email: 'a@example.test', hasSignIn: false },
      provider,
      redirectTo: 'x',
      link: linkOk,
    });
    expect(outcome).toEqual({ kind: 'LINKED_EXISTING' });
  });

  it('fails loudly when the account belongs to someone else on the team', async () => {
    const outcome = await inviteTeamMember({
      person: { id: 'p1', email: 'a@example.test', hasSignIn: false },
      provider: fakeProvider(),
      redirectTo: 'x',
      link: async () => err(domainError('db/unique', 'duplicate auth_user_id')),
    });
    expect(outcome.kind).toBe('FAILED');
  });

  it('passes on a failure from the auth service', async () => {
    const outcome = await inviteTeamMember({
      person: { id: 'p1', email: 'a@example.test', hasSignIn: false },
      provider: fakeProvider({
        invite: async () => err(domainError('auth-admin/invite-failed', 'Rate limited.')),
      }),
      redirectTo: 'x',
      link: linkOk,
    });
    expect(outcome).toEqual({ kind: 'FAILED', message: 'Rate limited.' });
  });
});

describe('adding a person', () => {
  const valid = {
    firstName: 'Test',
    lastName: '',
    email: '',
    role: 'DRIVER',
    isPartner: false,
    partnerTitle: '',
    isDriver: true,
    sendInvitation: true,
  };

  it('accepts a person with no email — never substitutes a placeholder', () => {
    const parsed = addPersonSchema.parse(valid);
    expect(parsed.email).toBeNull();
    expect(parsed.lastName).toBeNull();
  });

  it('normalises an email it is given', () => {
    expect(
      addPersonSchema.parse({ ...valid, email: '  Person@Example.TEST ' }).email,
    ).toBe('person@example.test');
  });

  it('refuses something that is not an email', () => {
    expect(addPersonSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('accepts every role — not everyone is a driver', () => {
    for (const role of ['PARTNER', 'DRIVER', 'ADMIN']) {
      expect(addPersonSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
    expect(addPersonSchema.safeParse({ ...valid, role: 'OWNER' }).success).toBe(false);
  });

  it('asks for a business role when someone is marked a partner', () => {
    expect(addPersonSchema.safeParse({ ...valid, isPartner: true }).success).toBe(false);
    expect(
      addPersonSchema.safeParse({
        ...valid,
        isPartner: true,
        partnerTitle: 'Test Partner',
      }).success,
    ).toBe(true);
  });
});

describe('a new password', () => {
  it('must be at least 12 characters and typed the same twice', () => {
    expect(
      newPasswordSchema.safeParse({ password: 'short', confirm: 'short' }).success,
    ).toBe(false);
    expect(
      newPasswordSchema.safeParse({
        password: 'a-long-passphrase',
        confirm: 'different-phrase',
      }).success,
    ).toBe(false);
    expect(
      newPasswordSchema.safeParse({
        password: 'a-long-passphrase',
        confirm: 'a-long-passphrase',
      }).success,
    ).toBe(true);
  });
});

describe('the admin role — Ronald’s', () => {
  // Imported here rather than at the top so this block reads on its own.
  it('lands on the Command Centre, and alone may manage people', async () => {
    const { can, homeRouteFor, CAPABILITIES } = await import('@/lib/permissions');

    expect(homeRouteFor('ADMIN')).toBe('/command-centre');
    // Everything a partner can do…
    for (const capability of CAPABILITIES) expect(can('ADMIN', capability)).toBe(true);
    // …and managing people is the admin's alone.
    expect(can('ADMIN', 'users.manage')).toBe(true);
    expect(can('PARTNER', 'users.manage')).toBe(false);
    expect(can('DRIVER', 'users.manage')).toBe(false);
  });

  it('sends a driver — Moh — to the driver app, with no people management', async () => {
    const { can, homeRouteFor } = await import('@/lib/permissions');
    expect(homeRouteFor('DRIVER')).toBe('/driver/today');
    expect(can('DRIVER', 'users.manage')).toBe(false);
    expect(can('DRIVER', 'financials.view')).toBe(false);
  });
});
