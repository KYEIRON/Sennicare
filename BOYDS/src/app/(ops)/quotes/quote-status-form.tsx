'use client';

import { useActionState } from 'react';
import { updateQuoteStatus } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { QUOTE_STATUSES } from '@/validation/crm';

export function QuoteStatusForm({
  quoteId,
  currentStatus,
}: Readonly<{ quoteId: string; currentStatus: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateQuoteStatus,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="quoteId" value={quoteId} />

      <select
        name="status"
        defaultValue={currentStatus}
        aria-label="Quote status"
        className="rounded border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1.5 text-xs text-boyd-light-200"
      >
        {QUOTE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status.toLowerCase()}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={pending}
        className="rounded border border-boyd-navy-700 px-3 py-1.5 text-xs text-boyd-light-300 hover:border-boyd-blue-500 disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Update'}
      </button>

      {state.error && <span className="text-xs text-boyd-negative">{state.error}</span>}
      {state.success && (
        <span className="text-xs text-boyd-positive">{state.success}</span>
      )}
    </form>
  );
}
