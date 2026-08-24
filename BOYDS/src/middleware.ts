/**
 * Session refresh and route protection.
 *
 * Middleware runs before every matched request. It does two things:
 *
 * 1. Refreshes the Supabase session cookie, which server components cannot do.
 * 2. Turns away unauthenticated visitors at the edge of protected areas.
 *
 * Middleware is NOT the authorisation boundary. It cannot read the user's BOYD'S
 * role without a database round trip on every request, so it checks only for the
 * presence of a session. Role enforcement happens in the layout guards and,, the
 * one that actually counts, in Postgres row level security.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Areas that require a signed-in session. */
const PROTECTED_PREFIXES = ['/command-centre', '/today', '/settings'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // With no database configured there is no session to refresh and no way to
  // authenticate anyone. Protected areas stay closed rather than open.
  if (!url || !anonKey) {
    if (isProtected(request.nextUrl.pathname)) {
      const target = request.nextUrl.clone();
      target.pathname = '/sign-in';
      target.searchParams.set('reason', 'not-configured');
      return NextResponse.redirect(target);
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase. getSession() only reads the
  // cookie, which a client could have tampered with, so it is not used here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = '/sign-in';
    target.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
