import { redirect } from 'next/navigation';
import { requirePartner } from '@/lib/auth/session';
import { AUTH_ERRORS } from '@/lib/auth/session';
import { homeRouteFor } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * Never statically prerendered or cached. A protected page must be evaluated
 * per request, against the caller's session — a cached copy of a signed-in
 * partner's page is a copy that could be served to someone else.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Partner operations OS — the Command Centre and everything behind it.
 *
 * The guard runs on the server, in the layout, so it covers every page in the
 * route group without each one having to remember. Row level security enforces
 * the same boundary independently at the database.
 */
export default async function OpsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const result = await requirePartner();

  if (!result.ok) {
    if (result.error.code === AUTH_ERRORS.FORBIDDEN) {
      // A signed-in driver who reaches a partner URL goes to their own app
      // rather than seeing an error. This is a wrong turn, not a failure.
      const current = await getCurrentUser();
      redirect(current.ok ? homeRouteFor(current.value.role) : '/sign-in');
    }
    redirect('/sign-in');
  }

  return <div className="min-h-screen bg-boyd-navy-950">{children}</div>;
}
