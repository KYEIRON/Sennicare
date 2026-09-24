'use client';

import { useActionState } from 'react';
import { recordExpense } from '../../actions';
import type { FormState } from '@/app/(ops)/customers/actions';

const CATEGORIES = ['TOLL', 'PARKING', 'SUPPLIES', 'MAINTENANCE', 'OTHER'] as const;

const CONTROL =
  'w-full rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100';

export function ExpenseForm({
  jobs,
}: Readonly<{ jobs: readonly { id: string; job_number: string }[] }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordExpense, {});

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="category" className="mb-1 block text-sm text-boyd-light-300">
          What was it?
        </label>
        <select id="category" name="category" required className={CONTROL}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.charAt(0) + category.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="amount" className="mb-1 block text-sm text-boyd-light-300">
          Amount
        </label>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          placeholder="$"
          className={CONTROL}
        />
        {state.fieldErrors?.amountCents?.[0] && (
          <p className="mt-1 text-sm text-boyd-negative">
            {state.fieldErrors.amountCents[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="jobId" className="mb-1 block text-sm text-boyd-light-300">
          Which job? (optional)
        </label>
        <select id="jobId" name="jobId" defaultValue="" className={CONTROL}>
          <option value="">Not job-specific</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.job_number}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm text-boyd-light-300">
          Note (optional)
        </label>
        <input id="description" name="description" maxLength={500} className={CONTROL} />
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
        {pending ? 'Saving…' : 'Record expense'}
      </button>
    </form>
  );
}
