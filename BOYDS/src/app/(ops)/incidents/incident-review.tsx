'use client';

import { useActionState } from 'react';
import { reviewIncident } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import type { IncidentStatus } from '@/types/operations';

/**
 * What BOYD'S did about it.
 *
 * This never touches the driver's account of events — that stays as filed. The
 * cost is left blank until someone establishes it; a blank saves nothing and
 * leaves any figure already recorded alone.
 */
export function IncidentReview({
  incidentId,
  currentStatus,
}: Readonly<{ incidentId: string; currentStatus: IncidentStatus }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    reviewIncident,
    {},
  );

  return (
    <form action={action} className="mt-4 border-t border-boyd-navy-700 pt-3">
      <input type="hidden" name="incidentId" value={incidentId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`status-${incidentId}`}
            className="mb-1 block text-xs text-boyd-light-400"
          >
            Where it stands
          </label>
          <select
            id={`status-${incidentId}`}
            name="status"
            defaultValue={currentStatus}
            className="w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2 text-boyd-light-100"
          >
            <option value="REPORTED">Reported</option>
            <option value="UNDER_REVIEW">Looking into it</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`cost-${incidentId}`}
            className="mb-1 block text-xs text-boyd-light-400"
          >
            What it cost BOYD&rsquo;S
          </label>
          <input
            id={`cost-${incidentId}`}
            name="cost"
            inputMode="decimal"
            placeholder="Leave blank if not known"
            className="w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2 text-boyd-light-100 placeholder:text-boyd-light-500"
          />
          {state.fieldErrors?.costCents?.[0] && (
            <p className="mt-1 text-sm text-boyd-negative">
              {state.fieldErrors.costCents[0]}
            </p>
          )}
        </div>

        <div className="sm:col-span-3">
          <label
            htmlFor={`notes-${incidentId}`}
            className="mb-1 block text-xs text-boyd-light-400"
          >
            What was done about it
          </label>
          <textarea
            id={`notes-${incidentId}`}
            name="resolutionNotes"
            rows={2}
            maxLength={4000}
            className="w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2 text-boyd-light-100"
          />
          {state.fieldErrors?.resolutionNotes?.[0] && (
            <p className="mt-1 text-sm text-boyd-negative">
              {state.fieldErrors.resolutionNotes[0]}
            </p>
          )}
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-sm text-boyd-negative">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-2 text-sm text-boyd-positive">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md border border-boyd-navy-700 px-3 py-1.5 text-sm font-medium text-boyd-light-200 hover:border-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
