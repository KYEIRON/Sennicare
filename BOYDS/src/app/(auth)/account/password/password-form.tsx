'use client';

import { useActionState } from 'react';
import { setPassword, type PasswordState } from './actions';

const CONTROL =
  'w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2.5 text-boyd-light-100 focus:border-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-500/40 focus:outline-none';

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    setPassword,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-boyd-light-300">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className={CONTROL}
        />
        <p className="mt-1 text-xs text-boyd-light-400">
          At least 12 characters. A few unrelated words is easier to remember and harder
          to guess than a short, complicated one.
        </p>
        {state.fieldErrors?.password?.map((message) => (
          <p key={message} className="mt-1 text-sm text-boyd-negative">
            {message}
          </p>
        ))}
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm text-boyd-light-300">
          The same again
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className={CONTROL}
        />
        {state.fieldErrors?.confirm?.map((message) => (
          <p key={message} className="mt-1 text-sm text-boyd-negative">
            {message}
          </p>
        ))}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-boyd-negative">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-boyd-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-boyd-blue-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Set password and continue'}
      </button>
    </form>
  );
}
