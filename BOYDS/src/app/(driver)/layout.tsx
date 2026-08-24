import { redirect } from 'next/navigation';
import { AUTH_ERRORS, getCurrentUser, requireDriver } from '@/lib/auth/session';
import { homeRouteFor } from '@/lib/permissions';

/**
 * Never statically prerendered or cached. A protected page must be evaluated
 * per request, against the caller's session — a cached copy of a signed-in
 * partner's page is a copy that could be served to someone else.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Moh's driver application — mobile first.
 *
 * Requires an active DRIVER session. This surface reads jobs through a view
 * containing no price, cost, contribution, or margin column, and holds no grant
 * on customers, quotes, invoices, or pricing rules. See docs/SECURITY.md and
 * docs/DRIVER_APP.md.
 */
export default async function DriverLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const result = await requireDriver();

  if (!result.ok) {
    if (result.error.code === AUTH_ERRORS.FORBIDDEN) {
      const current = await getCurrentUser();
      redirect(current.ok ? homeRouteFor(current.value.role) : '/sign-in');
    }
    redirect('/sign-in');
  }

  return <div className="min-h-screen bg-boyd-navy-900">{children}</div>;
}
