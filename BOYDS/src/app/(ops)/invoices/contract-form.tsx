'use client';

import { useActionState } from 'react';
import { createContract, setContractStatus } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

/**
 * A recurring agreement with a customer.
 *
 * This is how one-off jobs become predictable work. The terms are written down
 * once, here, rather than remembered differently by each partner.
 */
export function ContractForm({
  customers,
}: Readonly<{ customers: readonly { id: string; companyName: string }[] }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createContract,
    {},
  );

  if (customers.length === 0) {
    return (
      <p className="text-sm text-boyd-light-400">
        Add a customer first — a contract is an agreement with someone.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Field label="Customer" name="customerId" errors={state.fieldErrors}>
        <Select name="customerId" required defaultValue="">
          <option value="" disabled>
            Choose a customer
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.companyName}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="What is the agreement?"
        name="title"
        errors={state.fieldErrors}
        hint="How you would refer to it on the phone."
      >
        <TextInput
          name="title"
          required
          maxLength={200}
          placeholder="Weekly pharmacy run"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" name="status" errors={state.fieldErrors}>
          <Select name="status" defaultValue="DRAFT">
            <option value="DRAFT">Draft — not agreed yet</option>
            <option value="ACTIVE">Live</option>
            <option value="PAUSED">Paused</option>
            <option value="ENDED">Ended</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Field>
        <Field
          label="How often?"
          name="frequency"
          errors={state.fieldErrors}
          hint="In your words."
        >
          <TextInput name="frequency" maxLength={150} placeholder="Twice a week" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Starts"
          name="startDate"
          errors={state.fieldErrors}
          hint="Required once it is live."
        >
          <TextInput name="startDate" type="date" />
        </Field>
        <Field
          label="Ends"
          name="endDate"
          errors={state.fieldErrors}
          hint="Leave blank if open-ended."
        >
          <TextInput name="endDate" type="date" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Agreed rate"
          name="agreedRateCents"
          errors={state.fieldErrors}
          hint="Leave blank if no rate is settled yet."
        >
          <TextInput name="agreedRate" inputMode="decimal" placeholder="$" />
        </Field>
        <Field
          label="Rate is per"
          name="rateBasis"
          errors={state.fieldErrors}
          hint="Per run, per mile, per month."
        >
          <TextInput name="rateBasis" maxLength={100} />
        </Field>
      </div>

      <p className="rounded border border-boyd-navy-700 bg-boyd-navy-950 p-3 text-xs text-boyd-light-400">
        A blank rate stays blank. It is not recorded as zero, because a contract priced at
        nothing would tell the profitability figures BOYD&rsquo;S agreed to work for free.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Minimum volume"
          name="minimumVolume"
          errors={state.fieldErrors}
          hint="Jobs they commit to."
        >
          <TextInput name="minimumVolume" inputMode="numeric" />
        </Field>
        <Field
          label="Payment terms"
          name="paymentTermsDays"
          errors={state.fieldErrors}
          hint="Days. Blank means not agreed."
        >
          <TextInput name="paymentTermsDays" inputMode="numeric" />
        </Field>
      </div>

      <Field label="Terms" name="terms" errors={state.fieldErrors}>
        <TextArea name="terms" rows={3} maxLength={8000} />
      </Field>

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

      <SubmitButton pending={pending}>Save contract</SubmitButton>
    </form>
  );
}

/** Move a contract between draft, live, paused and ended. */
export function ContractStatusControl({
  contractId,
  status,
}: Readonly<{ contractId: string; status: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    setContractStatus,
    {},
  );

  return (
    <form action={action} className="mt-2 flex items-center justify-end gap-2">
      <input type="hidden" name="contractId" value={contractId} />
      <select
        name="status"
        defaultValue={status}
        className="rounded border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1 text-xs text-boyd-light-200"
      >
        <option value="DRAFT">Draft</option>
        <option value="ACTIVE">Live</option>
        <option value="PAUSED">Paused</option>
        <option value="ENDED">Ended</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-boyd-navy-700 px-2 py-1 text-xs text-boyd-light-300 hover:border-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? '…' : 'Update'}
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-boyd-negative">
          {state.error}
        </span>
      )}
    </form>
  );
}
