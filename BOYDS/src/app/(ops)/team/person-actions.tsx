'use client';

import { useActionState, useState } from 'react';
import {
  addDriverRecord,
  addEmail,
  changeRole,
  deactivate,
  reactivate,
  sendInvitation,
} from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { USER_ROLES, type UserRole } from '@/types/auth';
import type { TeamAction } from '@/services/team/state';

const BUTTON =
  'rounded-md border border-boyd-navy-700 px-3 py-1.5 text-sm font-medium text-boyd-light-200 hover:border-boyd-blue-500 disabled:opacity-50';

/** The actions an admin can take on one person — only those that will work. */
export function PersonActions({
  personId,
  role,
  isDriver,
  actions,
  invitationsAvailable,
}: Readonly<{
  personId: string;
  role: UserRole;
  isDriver: boolean;
  actions: readonly TeamAction[];
  invitationsAvailable: boolean;
}>) {
  return (
    <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-boyd-navy-700 pt-3">
      {actions.includes('ADD_EMAIL') && <AddEmail personId={personId} />}
      {actions.includes('SEND_INVITATION') && (
        <OneClick
          personId={personId}
          action={sendInvitation}
          label="Send invitation"
          disabled={!invitationsAvailable}
        />
      )}
      {actions.includes('RESEND_INVITATION') && (
        <OneClick
          personId={personId}
          action={sendInvitation}
          label="Resend invitation"
          disabled={!invitationsAvailable}
        />
      )}
      {actions.includes('SEND_PASSWORD_RESET') && (
        <OneClick
          personId={personId}
          action={sendInvitation}
          label="Send password reset"
          disabled={!invitationsAvailable}
        />
      )}
      {actions.includes('CHANGE_ROLE') && <ChangeRole personId={personId} role={role} />}
      {!isDriver && (
        <OneClick
          personId={personId}
          action={addDriverRecord}
          label="Add driver record"
        />
      )}
      {actions.includes('DEACTIVATE') && (
        <OneClick
          personId={personId}
          action={deactivate}
          label="Deactivate"
          confirm="Deactivate this person? They lose all access immediately. You can reactivate them later."
        />
      )}
      {actions.includes('REACTIVATE') && (
        <OneClick personId={personId} action={reactivate} label="Reactivate" />
      )}
    </div>
  );
}

function Result({ state }: Readonly<{ state: FormState }>) {
  if (state.error) {
    return (
      <p role="alert" className="basis-full text-sm text-boyd-negative">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="basis-full text-sm text-boyd-positive">
        {state.success}
      </p>
    );
  }
  return null;
}

function OneClick({
  personId,
  action,
  label,
  disabled = false,
  confirm,
}: Readonly<{
  personId: string;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  disabled?: boolean;
  confirm?: string;
}>) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className="contents"
    >
      <input type="hidden" name="personId" value={personId} />
      <button type="submit" disabled={disabled || pending} className={BUTTON}>
        {pending ? 'Working…' : label}
      </button>
      <Result state={state} />
    </form>
  );
}

function AddEmail({ personId }: Readonly<{ personId: string }>) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addEmail, {});
  return (
    <form action={formAction} className="flex basis-full flex-wrap items-center gap-2">
      <input type="hidden" name="personId" value={personId} />
      <label htmlFor={`email-${personId}`} className="sr-only">
        Their email address
      </label>
      <input
        id={`email-${personId}`}
        name="email"
        type="email"
        required
        placeholder="Their email address"
        className="min-w-56 flex-1 rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-1.5 text-sm text-boyd-light-100 placeholder:text-boyd-light-500"
      />
      <label className="flex items-center gap-1.5 text-xs text-boyd-light-300">
        <input type="checkbox" name="sendInvitation" defaultChecked className="h-4 w-4" />
        and invite them
      </label>
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? 'Saving…' : 'Save email'}
      </button>
      {state.fieldErrors?.email?.[0] && (
        <p className="basis-full text-sm text-boyd-negative">
          {state.fieldErrors.email[0]}
        </p>
      )}
      <Result state={state} />
    </form>
  );
}

function ChangeRole({ personId, role }: Readonly<{ personId: string; role: UserRole }>) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    changeRole,
    {},
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BUTTON}>
        Change role
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="personId" value={personId} />
      <label htmlFor={`role-${personId}`} className="sr-only">
        New role
      </label>
      <select
        id={`role-${personId}`}
        name="role"
        defaultValue={role}
        className="rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1.5 text-sm text-boyd-light-100"
      >
        {USER_ROLES.map((option) => (
          <option key={option} value={option}>
            {option.charAt(0) + option.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? 'Saving…' : 'Save role'}
      </button>
      <Result state={state} />
    </form>
  );
}
