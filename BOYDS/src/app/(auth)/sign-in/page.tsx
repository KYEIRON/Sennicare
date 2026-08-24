import type { Metadata } from 'next';
import { isDatabaseConfigured } from '@/lib/env';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const params = await searchParams;
  const configured = isDatabaseConfigured();

  return (
    <main className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-[0.25em] text-boyd-orange-500 uppercase">
          BOYD&rsquo;S Logistics LLC
        </p>
        <h1 className="mt-2 text-2xl font-bold text-boyd-light-50">Operations System</h1>
      </div>

      {!configured && (
        <div
          className="mb-6 rounded-lg border border-boyd-warning/40 bg-boyd-warning/10 p-4"
          role="status"
        >
          <p className="text-sm font-semibold tracking-wide text-boyd-warning uppercase">
            Not configured
          </p>
          <p className="mt-2 text-sm text-boyd-light-300">
            The BOYD&rsquo;S database has not been connected yet, so sign-in is
            unavailable. This is a setup step, not a fault.
          </p>
        </div>
      )}

      {params.reason === 'not-configured' && configured && (
        <p className="mb-4 text-sm text-boyd-light-400">Please sign in to continue.</p>
      )}

      <SignInForm disabled={!configured} />

      <p className="mt-8 text-center text-xs text-boyd-light-500">
        Accounts are created by a BOYD&rsquo;S partner. There is no public sign-up.
      </p>
    </main>
  );
}
