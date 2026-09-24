'use client';

import { useActionState } from 'react';
import { requestPasswordReset, type ResetState } from '../actions';

export function ResetForm({ disabled }: Readonly<{ disabled: boolean }>) {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.sent) {
    return (
      <p
        role="status"
        className="rounded-lg border border-boyd-positive/40 bg-boyd-positive/10 p-4 text-sm text-boyd-light-200"
      >
        If that address belongs to someone on the BOYD&rsquo;S team, a link to set a new
        password is on its way. It can take a few minutes.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-boyd-light-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={disabled}
          className="w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2.5 text-boyd-light-100 focus:border-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-500/40 focus:outline-none disabled:opacity-50"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-boyd-negative">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || pending}
        className="w-full rounded-md bg-boyd-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Email me a link'}
      </button>
    </form>
  );
}
