'use client';

import { useActionState } from 'react';
import { addVehicleCost } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { VEHICLE_COST_LINES } from '@/types/economics';
import { Field, Select, SubmitButton, TextInput } from '@/components/ui/form';

/**
 * Recording a real vehicle cost.
 *
 * Everything entered here is something BOYD'S actually pays. There is no field
 * for a flat cost-per-mile rate, because a typed-in rate is a guess wearing a
 * number's clothing and every job would inherit it invisibly.
 */
export function CostEntryForm({ vehicleId }: Readonly<{ vehicleId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addVehicleCost,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <p className="rounded border border-boyd-navy-700 bg-boyd-navy-950 p-3 text-xs text-boyd-light-400">
        Enter what BOYD&rsquo;S actually pays. The van&rsquo;s cost per mile is worked out
        from these and from real recorded mileage — it is never typed in directly.
      </p>

      <Field label="What is the cost?" name="costLine" errors={state.fieldErrors}>
        <Select name="costLine" required defaultValue="">
          <option value="" disabled>
            Choose
          </option>
          {VEHICLE_COST_LINES.map((line) => (
            <option key={line} value={line}>
              {line.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" name="amountCents" errors={state.fieldErrors}>
          <TextInput name="amount" inputMode="decimal" required placeholder="$" />
        </Field>
        <Field label="How often" name="period" errors={state.fieldErrors}>
          <Select name="period" defaultValue="MONTHLY">
            <option value="MONTHLY">Every month</option>
            <option value="ANNUAL">Every year</option>
            <option value="PER_MILE">Per mile</option>
            <option value="ONE_OFF">One-off</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts" name="effectiveFrom" errors={state.fieldErrors}>
          <TextInput name="effectiveFrom" type="date" required defaultValue={today} />
        </Field>
        <Field
          label="Ends"
          name="effectiveTo"
          errors={state.fieldErrors}
          hint="Leave blank if ongoing."
        >
          <TextInput name="effectiveTo" type="date" />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm text-boyd-light-300">
        <input
          type="checkbox"
          name="includedInCostPerMile"
          defaultChecked
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Count this towards cost per mile
          <span className="mt-0.5 block text-xs text-boyd-light-500">
            Untick to keep it on the books without charging it to jobs.
          </span>
        </span>
      </label>

      <Field label="Note" name="notes" errors={state.fieldErrors}>
        <TextInput name="notes" maxLength={500} />
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

      <SubmitButton pending={pending}>Record cost</SubmitButton>
    </form>
  );
}
