'use client';

/**
 * Finishing an invitation or password-setup link sent with Supabase's default
 * email template.
 *
 * Those links are verified by Supabase, which then hands the session over in
 * the URL fragment (`#access_token=…&refresh_token=…&type=invite`). A fragment
 * never reaches the server, so /auth/confirm sends such links here to be read
 * in the browser.
 *
 * The same rule as the server path applies: only an invitation or a password
 * reset is accepted. There is no sign-up link. The tokens are removed from the
 * address bar before anything else happens, so they are not left in history.
 */

import { useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browser';

const ACCEPTED = ['invite', 'recovery'];

export default function EmailLinkPage() {
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname);

    const go = (path: string) => window.location.replace(path);

    if (fragment.has('error') || fragment.has('error_code')) {
      return go('/sign-in?reason=link-expired');
    }

    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    const type = fragment.get('type');
    if (!accessToken || !refreshToken || !type || !ACCEPTED.includes(type)) {
      return go('/sign-in?reason=link-invalid');
    }

    const supabase = getBrowserClient();
    if (!supabase) return go('/sign-in?reason=not-configured');

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) =>
        go(error ? '/sign-in?reason=link-expired' : '/account/password'),
      );
  }, []);

  return (
    <main className="w-full max-w-sm text-center">
      <p className="text-xs font-semibold tracking-[0.25em] text-boyd-orange-500 uppercase">
        BOYD&rsquo;S Logistics LLC
      </p>
      <p className="mt-4 text-boyd-light-50" role="status">
        Checking your link…
      </p>
    </main>
  );
}
