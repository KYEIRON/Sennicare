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
 */

const ACCEPTED: readonly EmailOtpType[] = ['invite', 'recovery'];

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  const failed = (reason: string) => {
    const target = url.clone();
    target.pathname = '/sign-in';
    target.search = `?reason=${reason}`;
    return NextResponse.redirect(target);
  };

  if (!tokenHash || !type || !ACCEPTED.includes(type)) return failed('link-invalid');

  const supabase = await getServerClient();
  if (!supabase) return failed('not-configured');

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return failed('link-expired');

  const target = url.clone();
  target.pathname = '/account/password';
  target.search = '';
  return NextResponse.redirect(target);
}
