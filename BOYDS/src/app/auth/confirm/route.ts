import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getServerClient } from '@/lib/supabase/server';

/**
 * Where an invitation or a password-reset link lands.
 *
 * The emailed link carries a one-time token (Supabase's `token_hash`). Verifying
 * it here, on the server, signs the person in and sends them to set a password.
 * The Supabase email templates must point here — see docs/DEPLOYMENT.md.
 *
 * Only the two link types BOYD'S sends are accepted. There is no sign-up link:
 * nobody can create an account for themselves.
 *
 * Supabase's DEFAULT templates are also handled, because a free-tier project
 * without its own email provider cannot change them. Their link goes through
 * Supabase's verify endpoint first and arrives here in one of two shapes:
 *   * `?code=…` — a password reset requested from the sign-in page (PKCE);
 *   * nothing in the query, the session in the `#fragment` — an invitation or a
 *     password-setup email sent by an admin. The server never sees a fragment,
 *     so that case is handed to /sign-in/link, which reads it in the browser.
 */

const ACCEPTED: readonly EmailOtpType[] = ['invite', 'recovery'];

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');

  const failed = (reason: string) => {
    const target = url.clone();
    target.pathname = '/sign-in';
    target.search = `?reason=${reason}`;
    return NextResponse.redirect(target);
  };

  // A default-template link that failed verification (expired, already used)
  // reports it in the query.
  if (url.searchParams.has('error') || url.searchParams.has('error_code')) {
    return failed('link-expired');
  }

  // Nothing in the query: the session, if any, is in the fragment. The browser
  // keeps the fragment across this redirect.
  if (url.search === '') {
    const target = url.clone();
    target.pathname = '/sign-in/link';
    return NextResponse.redirect(target);
  }

  if (!code && (!tokenHash || !type || !ACCEPTED.includes(type))) {
    return failed('link-invalid');
  }

  const supabase = await getServerClient();
  if (!supabase) return failed('not-configured');

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });
  if (error) return failed('link-expired');

  const target = url.clone();
  target.pathname = '/account/password';
  target.search = '';
  return NextResponse.redirect(target);
}
