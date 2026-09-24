import type { Metadata } from 'next';
import Link from 'next/link';
import { isDatabaseConfigured } from '@/lib/env';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Forgot your password?' };

export default function ResetPasswordPage() {
  return (
    <main className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-[0.25em] text-boyd-orange-500 uppercase">
          BOYD&rsquo;S Logistics LLC
        </p>
        <h1 className="mt-2 text-2xl font-bold text-boyd-light-50">
          Forgot your password?
        </h1>
      </div>
      <p className="mb-6 text-sm text-boyd-light-300">
        Enter the email you sign in with, and we&rsquo;ll send a link to set a new one.
      </p>
      <ResetForm disabled={!isDatabaseConfigured()} />
      <p className="mt-8 text-center text-sm">
        <Link href="/sign-in" className="text-boyd-blue-300 hover:text-boyd-blue-400">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
