'use client';

import { useActionState } from 'react';
import { recordPayment } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';

const METHODS = ['BANK_TRANSFER', 'CHECK', 'CARD', 'CASH', 'OTHER'] as const;

export function PaymentForm({ invoiceId }: Readonly<{ invoiceId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordPayment, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div>
        <label
          htmlFor={`amount-${invoiceId}`}
          className="mb-1 block text-xs text-boyd-light-400"
        >
          Payment received
        </label>
        <input
          id={`amount-${invoiceId}`}
          name="amount"
          inputMode="decimal"
          required
          placeholder="$"
          className="w-28 rounded border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1.5 text-sm text-boyd-light-100"
        />
      </div>

      <select
        name="method"
        aria-label="Payment method"
        className="rounded border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1.5 text-sm text-boyd-light-200"
      >
        {METHODS.map((method) => (
          <option key={method} value={method}>
            {method.replace(/_/g, ' ').toLowerCase()}
          </option>
        ))}
      </select>

      <input
        name="reference"
        placeholder="Reference"
        maxLength={100}
        className="w-32 rounded border border-boyd-navy-700 bg-boyd-navy-950 px-2 py-1.5 text-sm text-boyd-light-100"
      />

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-boyd-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? 'Recording…' : 'Record payment'}
      </button>

      {state.error && <span className="text-xs text-boyd-negative">{state.error}</span>}
      {state.success && (
        <span className="text-xs text-boyd-positive">{state.success}</span>
      )}
    </form>
  );
}
