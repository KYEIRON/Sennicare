'use client';

import { useActionState, useState } from 'react';
import { createLead } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { REQUEST_SOURCES } from '@/types/operations';
import { LEAD_STAGES } from '@/validation/crm';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

export function LeadForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createLead, {});
  const [stage, setStage] = useState<string>('NEW');

  return (
    <form action={action} className="space-y-3">
      <Field label="Company" name="companyName" errors={state.fieldErrors}>
        <TextInput name="companyName" required maxLength={200} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact" name="contactName" errors={state.fieldErrors}>
          <TextInput name="contactName" maxLength={200} />
        </Field>
        <Field label="Phone" name="contactPhone" errors={state.fieldErrors}>
          <TextInput name="contactPhone" type="tel" maxLength={40} />
        </Field>
      </div>

      <Field label="Email" name="contactEmail" errors={state.fieldErrors}>
        <TextInput name="contactEmail" type="email" maxLength={254} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Stage" name="stage" errors={state.fieldErrors}>
          <Select
            name="stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
          >
            {LEAD_STAGES.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" name="source" errors={state.fieldErrors}>
          <Select name="source" defaultValue="PARTNER">
            {REQUEST_SOURCES.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {stage === 'LOST' && (
        <Field
          label="Why was it lost?"
          name="lostReason"
          errors={state.fieldErrors}
          hint="The reason is what eventually improves BOYD'S pricing and targeting."
        >
          <TextInput name="lostReason" required maxLength={500} />
        </Field>
      )}

      <Field
        label="What are they interested in?"
        name="serviceInterest"
        errors={state.fieldErrors}
      >
        <TextInput name="serviceInterest" maxLength={300} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Estimated value"
          name="estimatedValue"
          errors={state.fieldErrors}
          hint="Leave blank if unknown."
        >
          <TextInput name="estimatedValue" inputMode="decimal" placeholder="$" />
        </Field>
        <Field label="Follow up on" name="nextFollowupAt" errors={state.fieldErrors}>
          <TextInput name="nextFollowupAt" type="date" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-boyd-light-300">
        <input type="checkbox" name="isRecurring" className="h-4 w-4" />
        They need this regularly
      </label>

      <Field label="Notes" name="notes" errors={state.fieldErrors}>
        <TextArea name="notes" rows={2} />
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

      <SubmitButton pending={pending}>Save lead</SubmitButton>
    </form>
  );
}
