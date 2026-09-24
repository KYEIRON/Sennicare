'use client';

import { useActionState } from 'react';
import { unassignJob } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';

export function UnassignButton({ jobId }: Readonly<{ jobId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(unassignJob, {});

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      {state.error && <span className="text-xs text-boyd-negative">{state.error}</span>}
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-boyd-navy-700 px-3 py-1.5 text-xs text-boyd-light-300 transition-colors hover:border-boyd-negative hover:text-boyd-negative disabled:opacity-50"
      >
        {pending ? 'Unassigning…' : 'Unassign'}
      </button>
    </form>
  );
}
