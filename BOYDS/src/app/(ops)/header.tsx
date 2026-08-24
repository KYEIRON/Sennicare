import { formatOperatingDate, formatOperatingTime } from '@/lib/datetime';
import { signOut } from '@/app/(auth)/sign-in/actions';
import type { AppUser } from '@/types/auth';

/**
 * The Command Centre header.
 *
 * The mockup shows a system-health indicator. BOYD'S has no monitoring
 * integration, so rather than a green tick that means nothing, this states what
 * is actually known: the database is connected, because this page loaded.
 */
export function OpsHeader({ user, now }: Readonly<{ user: AppUser; now: Date }>) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-boyd-navy-800 bg-boyd-navy-950 px-4 py-3">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-boyd-orange-500 uppercase">
          BOYD&rsquo;S Logistics LLC
        </p>
        <h1 className="text-lg font-bold text-boyd-light-50">Operations System</h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm text-boyd-light-300">{formatOperatingDate(now)}</p>
          <p className="figure text-sm text-boyd-light-400">{formatOperatingTime(now)}</p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-boyd-light-100">{user.firstName}</p>
          <p className="text-xs text-boyd-light-400">
            {user.role === 'ADMIN' ? 'Administrator' : 'Partner'}
          </p>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-boyd-navy-700 px-3 py-1.5 text-sm text-boyd-light-300 transition-colors hover:border-boyd-navy-600 hover:text-boyd-light-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
