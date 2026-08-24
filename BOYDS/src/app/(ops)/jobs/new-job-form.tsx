'use client';

import { useActionState } from 'react';
import { createJob } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { JOB_PRIORITIES } from '@/types/operations';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

/**
 * The New Job workflow.
 *
 * Everything needed for a real job is validated before anything is saved, so an
 * incomplete job never appears on the schedule as though BOYD'S had agreed to
 * do it. A job starts at REQUESTED and is moved forward deliberately.
 */
export function NewJobForm({
  customers,
  jobTypes,
}: Readonly<{
  customers: readonly { id: string; companyName: string }[];
  jobTypes: readonly { id: string; name: string }[];
}>) {
  const [state, action, pending] = useActionState<FormState, FormData>(createJob, {});

  if (customers.length === 0) {
    return (
      <p className="text-sm text-boyd-light-400">
        Add a customer first — a job cannot exist without one.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
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

      <fieldset className="space-y-3 rounded border border-boyd-navy-700 p-3">
        <legend className="px-1 text-xs font-semibold tracking-wider text-boyd-orange-400 uppercase">
          Collection
        </legend>
        <Field label="Address" name="pickupAddress" errors={state.fieldErrors}>
          <TextInput name="pickupAddress" required maxLength={200} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="City" name="pickupCity" errors={state.fieldErrors}>
            <TextInput name="pickupCity" required maxLength={120} />
          </Field>
          <Field label="State" name="pickupState" errors={state.fieldErrors}>
            <TextInput name="pickupState" required maxLength={2} placeholder="NC" />
          </Field>
          <Field label="ZIP" name="pickupZip" errors={state.fieldErrors}>
            <TextInput name="pickupZip" required maxLength={10} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Contact" name="pickupContact" errors={state.fieldErrors}>
            <TextInput name="pickupContact" maxLength={200} />
          </Field>
          <Field label="Phone" name="pickupPhone" errors={state.fieldErrors}>
            <TextInput name="pickupPhone" type="tel" maxLength={40} />
          </Field>
        </div>
        <Field label="Instructions" name="pickupInstructions" errors={state.fieldErrors}>
          <TextArea name="pickupInstructions" rows={2} />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 rounded border border-boyd-navy-700 p-3">
        <legend className="px-1 text-xs font-semibold tracking-wider text-boyd-blue-300 uppercase">
          Delivery
        </legend>
        <Field label="Address" name="deliveryAddress" errors={state.fieldErrors}>
          <TextInput name="deliveryAddress" required maxLength={200} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="City" name="deliveryCity" errors={state.fieldErrors}>
            <TextInput name="deliveryCity" required maxLength={120} />
          </Field>
          <Field label="State" name="deliveryState" errors={state.fieldErrors}>
            <TextInput name="deliveryState" required maxLength={2} placeholder="NC" />
          </Field>
          <Field label="ZIP" name="deliveryZip" errors={state.fieldErrors}>
            <TextInput name="deliveryZip" required maxLength={10} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Contact" name="deliveryContact" errors={state.fieldErrors}>
            <TextInput name="deliveryContact" maxLength={200} />
          </Field>
          <Field label="Phone" name="deliveryPhone" errors={state.fieldErrors}>
            <TextInput name="deliveryPhone" type="tel" maxLength={40} />
          </Field>
        </div>
        <Field
          label="Instructions"
          name="deliveryInstructions"
          errors={state.fieldErrors}
        >
          <TextArea name="deliveryInstructions" rows={2} />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 rounded border border-boyd-navy-700 p-3">
        <legend className="px-1 text-xs font-semibold tracking-wider text-boyd-light-400 uppercase">
          Schedule and shipment
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Date" name="scheduledDate" errors={state.fieldErrors}>
            <TextInput name="scheduledDate" type="date" />
          </Field>
          <Field label="From" name="pickupTime" errors={state.fieldErrors}>
            <TextInput name="pickupTime" type="time" />
          </Field>
          <Field label="Until" name="windowEnd" errors={state.fieldErrors}>
            <TextInput name="windowEnd" type="time" />
          </Field>
        </div>
        <Field label="Description" name="description" errors={state.fieldErrors}>
          <TextArea name="description" rows={2} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Pieces" name="quantity" errors={state.fieldErrors}>
            <TextInput name="quantity" inputMode="numeric" />
          </Field>
          <Field label="Weight (lbs)" name="weightLbs" errors={state.fieldErrors}>
            <TextInput name="weightLbs" inputMode="decimal" />
          </Field>
          <Field label="Pallets" name="pallets" errors={state.fieldErrors}>
            <TextInput name="pallets" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Special handling" name="specialHandling" errors={state.fieldErrors}>
          <TextInput name="specialHandling" maxLength={1000} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Estimated miles"
            name="estimatedMiles"
            errors={state.fieldErrors}
            hint="An estimate. It never becomes the actual."
          >
            <TextInput name="estimatedMiles" inputMode="decimal" />
          </Field>
          <Field label="Quoted price" name="quotedPrice" errors={state.fieldErrors}>
            <TextInput name="quotedPrice" inputMode="decimal" placeholder="$" />
          </Field>
        </div>
      </fieldset>

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

      <SubmitButton pending={pending}>Create job</SubmitButton>
    </form>
  );
}
