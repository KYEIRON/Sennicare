'use client';

import { useActionState } from 'react';
import { createQuote } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { JOB_PRIORITIES } from '@/types/operations';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

export function QuoteForm({
  customers,
  jobTypes,
}: Readonly<{
  customers: readonly { id: string; companyName: string }[];
  jobTypes: readonly { id: string; name: string }[];
}>) {
  const [state, action, pending] = useActionState<FormState, FormData>(createQuote, {});

  if (customers.length === 0) {
    return (
      <p className="text-sm text-boyd-light-400">
        Add a customer first — a quote is issued to someone.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <p className="rounded border border-boyd-navy-700 bg-boyd-navy-950 p-3 text-xs text-boyd-light-400">
        BOYD&rsquo;S estimates the cost from recorded data: the latest fuel price, the
        van&rsquo;s real economy, and the derived vehicle cost per mile. Where any of
        those has not been recorded, the estimate shows what is missing rather than
        guessing.
      </p>

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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Job type" name="jobTypeId" errors={state.fieldErrors}>
          <Select name="jobTypeId" required defaultValue="">
            <option value="" disabled>
              Choose
            </option>
            {jobTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" name="priority" errors={state.fieldErrors}>
          <Select name="priority" defaultValue="STANDARD">
            {JOB_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Collection" name="collectionSummary" errors={state.fieldErrors}>
        <TextInput name="collectionSummary" maxLength={300} />
      </Field>
      <Field label="Delivery" name="deliverySummary" errors={state.fieldErrors}>
        <TextInput name="deliverySummary" maxLength={300} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Requested date" name="requestedDate" errors={state.fieldErrors}>
          <TextInput name="requestedDate" type="date" />
        </Field>
        <Field
          label="Estimated miles"
          name="estimatedMiles"
          errors={state.fieldErrors}
          hint="Required — the cost estimate rests on it."
        >
          <TextInput name="estimatedMiles" inputMode="decimal" required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Price you are quoting"
          name="quotedPrice"
          errors={state.fieldErrors}
        >
          <TextInput name="quotedPrice" inputMode="decimal" required placeholder="$" />
        </Field>
        <Field label="Valid until" name="validUntil" errors={state.fieldErrors}>
          <TextInput name="validUntil" type="date" />
        </Field>
      </div>

      <Field
        label="Override reason"
        name="overrideReason"
        errors={state.fieldErrors}
        hint="Only needed if the price falls below a configured minimum."
      >
        <TextInput name="overrideReason" maxLength={500} />
      </Field>

      <Field label="Terms" name="terms" errors={state.fieldErrors}>
        <TextArea name="terms" rows={2} />
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

      <SubmitButton pending={pending}>Create quote</SubmitButton>
    </form>
  );
}
