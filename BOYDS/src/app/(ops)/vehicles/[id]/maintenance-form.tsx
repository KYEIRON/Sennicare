'use client';

import { useActionState } from 'react';
import { recordMaintenance } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { Field, Select, SubmitButton, TextInput } from '@/components/ui/form';

const TYPES = [
  'SERVICE',
  'OIL',
  'TYRES',
  'REPAIR',
  'INSPECTION',
  'REGISTRATION',
  'INSURANCE',
  'OTHER',
] as const;

export function MaintenanceForm({ vehicleId }: Readonly<{ vehicleId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    recordMaintenance,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <Field label="What is it?" name="maintenanceType" errors={state.fieldErrors}>
        <Select name="maintenanceType" required defaultValue="SERVICE">
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type.toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Details" name="description" errors={state.fieldErrors}>
        <TextInput name="description" maxLength={500} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date" name="dueDate" errors={state.fieldErrors}>
          <TextInput name="dueDate" type="date" />
        </Field>
        <Field label="Or due at (miles)" name="dueMiles" errors={state.fieldErrors}>
          <TextInput name="dueMiles" inputMode="decimal" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Already done on"
          name="completedDate"
          errors={state.fieldErrors}
          hint="Leave blank if it is still due."
        >
          <TextInput name="completedDate" type="date" />
        </Field>
        <Field
          label="What it cost"
          name="costCents"
          errors={state.fieldErrors}
          hint="Blank means not yet priced — not free."
        >
          <TextInput name="cost" inputMode="decimal" placeholder="$" />
        </Field>
      </div>

      <Field label="Who did it" name="vendor" errors={state.fieldErrors}>
        <TextInput name="vendor" maxLength={200} />
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

      <SubmitButton pending={pending}>Save</SubmitButton>
    </form>
  );
}
