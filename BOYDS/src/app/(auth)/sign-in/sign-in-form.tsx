'use client';

import { useActionState } from 'react';
import { signIn, type SignInState } from './actions';

const initialState: SignInState = {};

export function SignInForm({ disabled }: Readonly<{ disabled: boolean }>) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm text-boyd-light-300">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={disabled || pending}
          aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
          className="w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-900 px-3 py-2.5 text-boyd-light-100 placeholder:text-boyd-light-500 focus:border-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-500/40 focus:outline-none disabled:opacity-50"
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="mt-1.5 text-sm text-boyd-negative">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm text-boyd-light-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={disabled || pending}
          aria-describedby={state.fieldErrors?.password ? 'password-error' : undefined}
          className="w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-900 px-3 py-2.5 text-boyd-light-100 focus:border-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-500/40 focus:outline-none disabled:opacity-50"
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="mt-1.5 text-sm text-boyd-negative">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-boyd-negative">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || pending}
        className="w-full rounded-md bg-boyd-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-400 focus:ring-offset-2 focus:ring-offset-boyd-navy-950 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
