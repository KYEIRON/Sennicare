'use client';

import { useActionState } from 'react';
import { createVehicle } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { VEHICLE_TYPES } from '@/types/operations';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

export function VehicleForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createVehicle, {});

  return (
    <form action={action} className="space-y-3">
      <p className="rounded border border-boyd-navy-700 bg-boyd-navy-950 p-3 text-xs text-boyd-light-400">
        Leave anything you do not have to hand blank. BOYD&rsquo;S shows{' '}
        <span className="font-semibold text-boyd-light-300">NOT CONFIGURED</span> rather
        than a guessed value — an unrecorded purchase price is not a free van.
      </p>

      <Field
        label="Vehicle code"
        name="vehicleCode"
        errors={state.fieldErrors}
        hint="For example BOYD-001."
      >
        <TextInput name="vehicleCode" required maxLength={30} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Make" name="make" errors={state.fieldErrors}>
          <TextInput name="make" maxLength={80} />
        </Field>
        <Field label="Model" name="model" errors={state.fieldErrors}>
          <TextInput name="model" maxLength={80} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Year" name="year" errors={state.fieldErrors}>
          <TextInput name="year" inputMode="numeric" />
        </Field>
        <Field label="Type" name="vehicleType" errors={state.fieldErrors}>
          <Select name="vehicleType" defaultValue="">
            <option value="">Not recorded</option>
            {VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Plate" name="licensePlate" errors={state.fieldErrors}>
          <TextInput name="licensePlate" maxLength={20} />
        </Field>
        <Field label="Plate state" name="licenseState" errors={state.fieldErrors}>
          <TextInput name="licenseState" maxLength={2} placeholder="NC" />
        </Field>
      </div>

      <Field
        label="VIN"
        name="vin"
        errors={state.fieldErrors}
        hint="17 characters, from the vehicle documents."
      >
        <TextInput name="vin" maxLength={17} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase date" name="purchaseDate" errors={state.fieldErrors}>
          <TextInput name="purchaseDate" type="date" />
        </Field>
        <Field label="Purchase price" name="purchasePrice" errors={state.fieldErrors}>
          <TextInput name="purchasePrice" inputMode="decimal" placeholder="$" />
        </Field>
      </div>

      <Field
        label="Current odometer (miles)"
        name="currentOdometer"
        errors={state.fieldErrors}
      >
        <TextInput name="currentOdometer" inputMode="decimal" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Insurance provider"
          name="insuranceProvider"
          errors={state.fieldErrors}
        >
          <TextInput name="insuranceProvider" maxLength={150} />
        </Field>
        <Field
          label="Renewal date"
          name="insuranceRenewalDate"
          errors={state.fieldErrors}
        >
          <TextInput name="insuranceRenewalDate" type="date" />
        </Field>
      </div>

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

      <SubmitButton pending={pending}>Save vehicle</SubmitButton>
    </form>
  );
}
