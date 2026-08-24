'use client';

import { useActionState } from 'react';
import { recordFuel } from '../../actions';
import type { FormState } from '@/app/(ops)/customers/actions';

const CONTROL =
  'w-full rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100';

export function FuelForm({
  jobs,
}: Readonly<{ jobs: readonly { id: string; job_number: string }[] }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordFuel, {});

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="gallons" className="mb-1 block text-sm text-boyd-light-300">
            Gallons
          </label>
          <input
            id="gallons"
            name="gallons"
            inputMode="decimal"
            required
            className={CONTROL}
          />
        </div>
        <div>
          <label
            htmlFor="pricePerGallon"
            className="mb-1 block text-sm text-boyd-light-300"
          >
            Price / gallon
          </label>
          <input
            id="pricePerGallon"
            name="pricePerGallon"
            inputMode="decimal"
            required
            placeholder="$"
            className={CONTROL}
          />
        </div>
      </div>

      <div>
        <label htmlFor="total" className="mb-1 block text-sm text-boyd-light-300">
          Total paid
        </label>
        <input
          id="total"
          name="total"
          inputMode="decimal"
          required
          placeholder="$"
          className={CONTROL}
        />
        <p className="mt-1 text-xs text-boyd-light-500">
          Copy the total from the receipt, even if it does not exactly match gallons times
          price.
        </p>
      </div>

      <div>
        <label htmlFor="odometer" className="mb-1 block text-sm text-boyd-light-300">
          Odometer (optional)
        </label>
        <input id="odometer" name="odometer" inputMode="decimal" className={CONTROL} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="station" className="mb-1 block text-sm text-boyd-light-300">
            Station (optional)
          </label>
          <input id="station" name="station" maxLength={150} className={CONTROL} />
        </div>
        <div>
          <label htmlFor="fuelJobId" className="mb-1 block text-sm text-boyd-light-300">
            Job (optional)
          </label>
          <select id="fuelJobId" name="jobId" defaultValue="" className={CONTROL}>
            <option value="">Not job-specific</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.job_number}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-boyd-blue-600 px-4 py-4 text-base font-bold text-white active:bg-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Record fuel'}
      </button>
    </form>
  );
}
