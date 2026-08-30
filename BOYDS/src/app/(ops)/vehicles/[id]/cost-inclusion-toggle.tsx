'use client';

import { useActionState } from 'react';
import { toggleCostInclusion } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';

export function CostInclusionToggle({
  entryId,
  vehicleId,
  included,
}: Readonly<{ entryId: string; vehicleId: string; included: boolean }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    toggleCostInclusion,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="include" value={String(!included)} />

      <button
        type="submit"
        disabled={pending}
        aria-label={included ? 'Exclude from cost per mile' : 'Include in cost per mile'}
        className={`rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wider transition-colors disabled:opacity-40 ${
          included
            ? 'border-boyd-positive/40 bg-boyd-positive/10 text-boyd-positive hover:border-boyd-positive'
            : 'border-boyd-navy-700 text-boyd-light-500 hover:border-boyd-light-500'
        }`}
      >
        {pending ? '…' : included ? 'INCLUDED' : 'EXCLUDED'}
      </button>

      {state.error && (
        <span className="ml-2 text-xs text-boyd-negative">{state.error}</span>
      )}
    </form>
  );
}
