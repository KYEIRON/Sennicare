'use client';

import { useActionState } from 'react';
import { sendInvoice } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';

export function SendInvoiceButton({ invoiceId }: Readonly<{ invoiceId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendInvoice, {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-boyd-navy-700 px-3 py-1.5 text-sm text-boyd-light-300 hover:border-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? 'Marking…' : 'Mark as sent'}
      </button>
      {state.success && (
        <span className="text-xs text-boyd-light-400">{state.success}</span>
      )}
      {state.error && <span className="text-xs text-boyd-negative">{state.error}</span>}
    </form>
  );
}
