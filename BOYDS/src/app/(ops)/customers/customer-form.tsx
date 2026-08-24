'use client';

import { useActionState } from 'react';
import { createCustomer, type FormState } from './actions';
import { CUSTOMER_TYPES, CUSTOMER_STATUSES } from '@/types/operations';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

export function CustomerForm({
  industries,
}: Readonly<{ industries: readonly { id: string; name: string }[] }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createCustomer,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <Field
        label="Company or customer name"
        name="companyName"
        errors={state.fieldErrors}
      >
        <TextInput name="companyName" required maxLength={200} />
      </Field>

      <Field label="Customer type" name="customerType" errors={state.fieldErrors}>
        <Select name="customerType" defaultValue="BUSINESS">
          {CUSTOMER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Industry" name="industryId" errors={state.fieldErrors}>
        <Select name="industryId" defaultValue="">
          <option value="">Not recorded</option>
          {industries.map((industry) => (
            <option key={industry.id} value={industry.id}>
              {industry.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Status" name="customerStatus" errors={state.fieldErrors}>
        <Select name="customerStatus" defaultValue="PROSPECT">
          {CUSTOMER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Payment terms (days)"
        name="paymentTermsDays"
        errors={state.fieldErrors}
        hint="Leave blank if not agreed. BOYD'S standard terms are not configured, and no default is assumed."
      >
        <TextInput name="paymentTermsDays" inputMode="numeric" />
      </Field>

      <Field label="How they found BOYD'S" name="leadSource" errors={state.fieldErrors}>
        <TextInput name="leadSource" maxLength={200} />
      </Field>

      <Field label="Notes" name="notes" errors={state.fieldErrors}>
        <TextArea name="notes" rows={3} />
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

      <SubmitButton pending={pending}>Save customer</SubmitButton>
    </form>
  );
}
