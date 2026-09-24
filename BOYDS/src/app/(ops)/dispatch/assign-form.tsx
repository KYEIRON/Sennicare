'use client';

import { useActionState } from 'react';
import { assignJob } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { Field, Select, TextInput } from '@/components/ui/form';

export function AssignForm({
  jobId,
  vehicles,
  drivers,
  defaultDate,
  defaultTime,
  defaultWindowEnd,
}: Readonly<{
  jobId: string;
  vehicles: readonly { id: string; vehicleCode: string }[];
  drivers: readonly { id: string; firstName: string }[];
  defaultDate: string | null;
  defaultTime: string | null;
  defaultWindowEnd: string | null;
}>) {
  const [state, action, pending] = useActionState<FormState, FormData>(assignJob, {});

  if (vehicles.length === 0 || drivers.length === 0) {
    return (
      <p className="text-sm text-boyd-light-400">
        A vehicle and a driver must both be available before a job can be dispatched.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Vehicle" name="vehicleId" errors={state.fieldErrors}>
          <Select name="vehicleId" required defaultValue="">
            <option value="" disabled>
              Choose
            </option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.vehicleCode}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Driver" name="driverId" errors={state.fieldErrors}>
          <Select name="driverId" required defaultValue="">
            <option value="" disabled>
              Choose
            </option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.firstName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Date" name="scheduledDate" errors={state.fieldErrors}>
          <TextInput
            name="scheduledDate"
            type="date"
            required
            defaultValue={defaultDate ?? ''}
          />
        </Field>
        <Field label="From" name="scheduledTime" errors={state.fieldErrors}>
          <TextInput
            name="scheduledTime"
            type="time"
            required
            defaultValue={defaultTime?.slice(0, 5) ?? ''}
          />
        </Field>
        <Field label="Until" name="scheduledWindowEnd" errors={state.fieldErrors}>
          <TextInput
            name="scheduledWindowEnd"
            type="time"
            defaultValue={defaultWindowEnd?.slice(0, 5) ?? ''}
          />
        </Field>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded border border-boyd-negative/40 bg-boyd-negative/10 p-2 text-sm text-boyd-negative"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-boyd-positive">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-boyd-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? 'Assigning…' : 'Assign'}
      </button>
    </form>
  );
}
