'use client';

import { useActionState, useState } from 'react';
import { addPerson } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { USER_ROLES } from '@/types/auth';
import { ROLE_DESCRIPTIONS } from '@/services/team/state';
import { Field, Select, SubmitButton, TextInput } from '@/components/ui/form';

/**
 * Add anyone: an admin, a partner, a driver — or a partner who drives.
 *
 * The email may be left blank. The person is then recorded as waiting for it,
 * with any partner and driver records in place, and invited once the real
 * address is known. Nothing is ever filled in for them.
 */
export function AddPersonForm({
  invitationsAvailable,
}: Readonly<{ invitationsAvailable: boolean }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(addPerson, {});
  const [role, setRole] = useState<string>('DRIVER');
  const [isPartner, setIsPartner] = useState(false);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" errors={state.fieldErrors}>
          <TextInput name="firstName" required maxLength={100} />
        </Field>
        <Field label="Last name" name="lastName" errors={state.fieldErrors}>
          <TextInput name="lastName" maxLength={100} />
        </Field>
      </div>

      <Field
        label="Email"
        name="email"
        errors={state.fieldErrors}
        hint="Leave blank if you don't have it yet. They'll wait on the list until you add it."
      >
        <TextInput name="email" type="email" autoComplete="off" />
      </Field>

      <Field label="Role" name="role" errors={state.fieldErrors}>
        <Select
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          {USER_ROLES.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>
      <p className="-mt-1 text-xs text-boyd-light-400">
        {ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}
      </p>

      <label className="flex items-start gap-2 text-sm text-boyd-light-300">
        <input
          type="checkbox"
          name="isPartner"
          className="mt-0.5 h-4 w-4"
          checked={isPartner}
          onChange={(event) => setIsPartner(event.target.checked)}
        />
        <span>
          A business partner
          <span className="block text-xs text-boyd-light-400">
            An owner of BOYD&rsquo;S, whatever their role in the system.
          </span>
        </span>
      </label>
      {isPartner && (
        <Field
          label="Their role in the business"
          name="partnerTitle"
          errors={state.fieldErrors}
        >
          <TextInput name="partnerTitle" maxLength={150} />
        </Field>
      )}

      <label className="flex items-start gap-2 text-sm text-boyd-light-300">
        <input type="checkbox" name="isDriver" className="mt-0.5 h-4 w-4" />
        <span>
          Drives for BOYD&rsquo;S
          <span className="block text-xs text-boyd-light-400">
            Creates their driver record, so jobs can be assigned to them.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm text-boyd-light-300">
        <input
          type="checkbox"
          name="sendInvitation"
          defaultChecked={invitationsAvailable}
          disabled={!invitationsAvailable}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Email them an invitation now
          {!invitationsAvailable && (
            <span className="block text-xs text-boyd-warning">
              Not available until the service role key is configured.
            </span>
          )}
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-boyd-negative">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-boyd-positive">
          {state.success}
        </p>
      )}

      <SubmitButton pending={pending}>Add person</SubmitButton>
    </form>
  );
}
