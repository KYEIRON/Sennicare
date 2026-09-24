'use client';

import { useActionState, useState } from 'react';
import { updateLeadStage } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { LEAD_STAGES } from '@/validation/crm';

export function StageForm({
  leadId,
  currentStage,
}: Readonly<{ leadId: string; currentStage: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateLeadStage,
    {},
  );
  const [stage, setStage] = useState(currentStage);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />

      <select
        name="stage"
        value={stage}
        onChange={(event) => setStage(event.target.value)}
        aria-label="Pipeline stage"
        className="rounded border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1.5 text-xs text-boyd-light-200"
      >
        {LEAD_STAGES.map((value) => (
          <option key={value} value={value}>
            {value.replace(/_/g, ' ').toLowerCase()}
          </option>
        ))}
      </select>

      {stage === 'LOST' && (
        <input
          name="lostReason"
          required
          placeholder="Why was it lost?"
          maxLength={500}
          className="flex-1 rounded border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1.5 text-xs text-boyd-light-200"
        />
      )}

      <button
        type="submit"
        disabled={pending || stage === currentStage}
        className="rounded border border-boyd-navy-700 px-3 py-1.5 text-xs text-boyd-light-300 hover:border-boyd-blue-500 disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Update'}
      </button>

      {state.error && <span className="text-xs text-boyd-negative">{state.error}</span>}
    </form>
  );
}
