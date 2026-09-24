import type { Metadata } from 'next';
import { requireCapability } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { getAuthAdmin } from '@/integrations/auth-admin';
import { listTeam } from '@/database/team';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { formatOperatingDate } from '@/lib/datetime';
import {
  availableActions,
  teamMemberState,
  TEAM_STATE_LABELS,
  type TeamMemberState,
} from '@/services/team/state';
import { AddPersonForm } from './add-person-form';
import { PersonActions } from './person-actions';

export const metadata: Metadata = { title: 'Team' };

const STATE_STYLES: Readonly<Record<TeamMemberState, string>> = {
  ACTIVE: 'bg-boyd-positive/15 text-boyd-positive',
  INVITED: 'bg-boyd-blue-600/20 text-boyd-light-200',
  NOT_INVITED: 'bg-boyd-warning/15 text-boyd-warning',
  WAITING_FOR_EMAIL: 'bg-boyd-warning/15 text-boyd-warning',
  SUSPENDED: 'bg-boyd-negative/15 text-boyd-negative',
  DEACTIVATED: 'bg-boyd-navy-800 text-boyd-light-400',
};

/**
 * The team: who can sign in, as what, and in what state.
 *
 * People are records, not code. Adding a driver, a partner or an admin,
 * changing a role, deactivating someone who has left — all happen here, by an
 * admin, with no developer involved. The database enforces every rule this
 * screen follows (migration 0027), so the screen is a convenience, not the
 * control.
 */
export default async function TeamPage() {
  const auth = await requireCapability('users.manage');
  if (!auth.ok) {
    return (
      <Panel title="Team">
        <p className="text-sm text-boyd-light-300">
          Only an admin can manage the team. Ask an admin to add or change people.
        </p>
      </Panel>
    );
  }

  const supabase = await getServerClient();
  if (!supabase) return null;

  const result = await listTeam(supabase);
  const team = result.ok ? result.value : [];
  const invitationsAvailable = getAuthAdmin().available;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        {!invitationsAvailable && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-boyd-warning/40 bg-boyd-warning/5 p-4 text-sm text-boyd-light-300"
          >
            <DataBadge kind="UNAVAILABLE" />
            Invitations cannot be sent: the server has no Supabase service role key.
            People can still be added and managed; their invitations can be sent once the
            key is configured.
          </div>
        )}

        <Panel title={`Team (${team.length})`}>
          {team.length === 0 ? (
            <EmptyState>No one yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {team.map((person) => {
                const state = teamMemberState(person);
                const self = person.id === auth.value.id;
                return (
                  <li key={person.id} className="rounded border border-boyd-navy-700 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-boyd-light-100">
                        {[person.firstName, person.lastName].filter(Boolean).join(' ')}
                        {self && (
                          <span className="ml-1 text-xs font-normal text-boyd-light-400">
                            (you)
                          </span>
                        )}
                      </span>
                      <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                        {person.role}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${STATE_STYLES[state]}`}
                      >
                        {TEAM_STATE_LABELS[state]}
                      </span>
                      {person.isDriver && (
                        <span className="rounded bg-boyd-orange-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-orange-400">
                          DRIVES
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-boyd-light-300">
                      {person.email ?? (
                        <span className="text-boyd-warning">No email address yet</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-boyd-light-400">
                      {person.partnerTitle ? `${person.partnerTitle} · ` : ''}
                      {person.lastLoginAt
                        ? `Last signed in ${formatOperatingDate(new Date(person.lastLoginAt))}`
                        : 'Has not signed in yet'}
                    </p>

                    <PersonActions
                      personId={person.id}
                      role={person.role}
                      isDriver={person.isDriver}
                      actions={availableActions(person, auth.value.id)}
                      invitationsAvailable={invitationsAvailable}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Add a person">
        <AddPersonForm invitationsAvailable={invitationsAvailable} />
      </Panel>
    </div>
  );
}
