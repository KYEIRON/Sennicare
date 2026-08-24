'use client';

import { useActionState } from 'react';
import { advanceJobStatus, recordJobCosts, recordJobMileage } from '../actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import type { Transition } from '@/services/jobs/state-machine';
import { Field, Select, TextInput } from '@/components/ui/form';
import { Panel } from '@/components/ui/kpi-card';

export function JobActions({
  jobId,
  transitions,
}: Readonly<{ jobId: string; transitions: readonly Transition[] }>) {
  const [statusState, statusAction, statusPending] = useActionState<FormState, FormData>(
    advanceJobStatus,
    {},
  );
  const [costState, costAction, costPending] = useActionState<FormState, FormData>(
    recordJobCosts,
    {},
  );
  const [mileageState, mileageAction, mileagePending] = useActionState<
    FormState,
    FormData
  >(recordJobMileage, {});

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Move this job forward">
        {transitions.length === 0 ? (
          <p className="text-sm text-boyd-light-400">
            This job has reached the end of its lifecycle. No further status change is
            possible.
          </p>
        ) : (
          <form action={statusAction} className="space-y-3">
            <input type="hidden" name="jobId" value={jobId} />
            <Field label="Next status" name="toStatus" errors={statusState.fieldErrors}>
              <Select name="toStatus" required defaultValue="">
                <option value="" disabled>
                  Choose
                </option>
                {transitions.map((transition) => (
                  <option key={transition.to} value={transition.to}>
                    {transition.to.replace(/_/g, ' ')} — {transition.description}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Reason"
              name="reason"
              errors={statusState.fieldErrors}
              hint="Required when cancelling."
            >
              <TextInput name="reason" maxLength={500} />
            </Field>

            {statusState.error && (
              <p role="alert" className="text-sm text-boyd-negative">
                {statusState.error}
              </p>
            )}
            {statusState.success && (
              <p role="status" className="text-sm text-boyd-positive">
                {statusState.success}
              </p>
            )}

            <button
              type="submit"
              disabled={statusPending}
              className="w-full rounded-md bg-boyd-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-boyd-blue-500 disabled:opacity-50"
            >
              {statusPending ? 'Updating…' : 'Update status'}
            </button>
          </form>
        )}
      </Panel>

      <Panel title="Record actual costs">
        <form action={costAction} className="space-y-2">
          <input type="hidden" name="jobId" value={jobId} />
          <p className="text-xs text-boyd-light-500">
            Leave a cost blank if you do not have it yet. It stays MISSING rather than
            becoming zero — contribution will show DATA INCOMPLETE until it is recorded.
          </p>

          <Field label="Agreed price" name="wonPrice" errors={costState.fieldErrors}>
            <TextInput name="wonPrice" inputMode="decimal" placeholder="$" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fuel" name="fuelCost" errors={costState.fieldErrors}>
              <TextInput name="fuelCost" inputMode="decimal" placeholder="$" />
            </Field>
            <Field label="Driver" name="driverCost" errors={costState.fieldErrors}>
              <TextInput name="driverCost" inputMode="decimal" placeholder="$" />
            </Field>
            <Field label="Vehicle" name="vehicleCost" errors={costState.fieldErrors}>
              <TextInput name="vehicleCost" inputMode="decimal" placeholder="$" />
            </Field>
            <Field label="Tolls" name="tollCost" errors={costState.fieldErrors}>
              <TextInput name="tollCost" inputMode="decimal" placeholder="$" />
            </Field>
            <Field label="Parking" name="parkingCost" errors={costState.fieldErrors}>
              <TextInput name="parkingCost" inputMode="decimal" placeholder="$" />
            </Field>
            <Field label="Other" name="otherCost" errors={costState.fieldErrors}>
              <TextInput name="otherCost" inputMode="decimal" placeholder="$" />
            </Field>
          </div>

          {costState.error && (
            <p role="alert" className="text-sm text-boyd-negative">
              {costState.error}
            </p>
          )}
          {costState.success && (
            <p role="status" className="text-sm text-boyd-positive">
              {costState.success}
            </p>
          )}

          <button
            type="submit"
            disabled={costPending}
            className="w-full rounded-md bg-boyd-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-boyd-blue-500 disabled:opacity-50"
          >
            {costPending ? 'Recording…' : 'Record costs'}
          </button>
        </form>
      </Panel>

      <Panel title="Record mileage">
        <form action={mileageAction} className="space-y-2">
          <input type="hidden" name="jobId" value={jobId} />
          <p className="text-xs text-boyd-light-500">
            Loaded plus empty must equal the total. Empty miles are the ones driven
            without a load — one of the numbers BOYD&rsquo;S watches most closely.
          </p>

          <Field label="Total miles" name="actualMiles" errors={mileageState.fieldErrors}>
            <TextInput name="actualMiles" inputMode="decimal" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Loaded" name="loadedMiles" errors={mileageState.fieldErrors}>
              <TextInput name="loadedMiles" inputMode="decimal" />
            </Field>
            <Field label="Empty" name="emptyMiles" errors={mileageState.fieldErrors}>
              <TextInput name="emptyMiles" inputMode="decimal" />
            </Field>
          </div>

          {mileageState.error && (
            <p role="alert" className="text-sm text-boyd-negative">
              {mileageState.error}
            </p>
          )}
          {mileageState.success && (
            <p role="status" className="text-sm text-boyd-positive">
              {mileageState.success}
            </p>
          )}

          <button
            type="submit"
            disabled={mileagePending}
            className="w-full rounded-md bg-boyd-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-boyd-blue-500 disabled:opacity-50"
          >
            {mileagePending ? 'Recording…' : 'Record mileage'}
          </button>
        </form>
      </Panel>
    </div>
  );
}
