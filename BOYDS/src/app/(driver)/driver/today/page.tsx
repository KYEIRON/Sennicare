import type { Metadata } from 'next';
import Link from 'next/link';
import { requireDriver } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listDriverJobs } from '@/database/operations';
import { operatingDateKey, formatOperatingDate } from '@/lib/datetime';
import { DataBadge } from '@/components/ui/data-badge';
import { signOut } from '@/app/(auth)/sign-in/actions';

export const metadata: Metadata = { title: 'Today' };

/**
 * The driver's day.
 *
 * Mobile first: large touch targets, one obvious action, minimal reading. Moh
 * uses this in a van, in daylight, often in a hurry.
 *
 * Everything here comes from driver_jobs, which contains no price, cost,
 * contribution or margin column. The driver boundary is structural.
 */
export default async function DriverTodayPage() {
  const auth = await requireDriver();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const now = new Date();
  const today = operatingDateKey(now);

  const result = await listDriverJobs(supabase, today);
  const jobs = result.ok ? result.value : [];

  const current = jobs.find((job) =>
    [
      'DRIVER_ACCEPTED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'AT_DELIVERY',
    ].includes(job.status),
  );
  const upcoming = jobs.filter((job) => job.id !== current?.id);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-boyd-orange-500 uppercase">
          BOYD&rsquo;S Logistics LLC
        </p>
        <h1 className="mt-1 text-2xl font-bold text-boyd-light-50">
          Good morning, {auth.value.firstName}
        </h1>
        <p className="mt-1 text-sm text-boyd-light-400">{formatOperatingDate(now)}</p>
      </header>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 p-6 text-center">
          <p className="text-boyd-light-300">No jobs scheduled for today.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {current && (
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-[0.15em] text-boyd-orange-400 uppercase">
                Current job
              </h2>
              <Link
                href={`/driver/jobs/${current.id}`}
                className="block rounded-lg border-2 border-boyd-orange-500/50 bg-boyd-navy-950 p-5 transition-colors active:bg-boyd-navy-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="figure text-lg font-bold text-boyd-light-50">
                    {current.job_number}
                  </span>
                  <span className="rounded bg-boyd-orange-500/20 px-2.5 py-1 text-[11px] font-bold tracking-wider text-boyd-orange-400">
                    {current.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-2 text-base text-boyd-light-200">
                  {current.customer_company_name}
                </p>
                <p className="text-sm text-boyd-light-400">{current.job_type_name}</p>
              </Link>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold tracking-[0.15em] text-boyd-light-400 uppercase">
              {current ? 'Later today' : "Today's jobs"}
            </h2>
            <ul className="space-y-3">
              {upcoming.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/driver/jobs/${job.id}`}
                    className="block rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 p-5 transition-colors active:bg-boyd-navy-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="figure font-bold text-boyd-light-100">
                        {job.job_number}
                      </span>
                      <span className="figure text-sm text-boyd-light-400">
                        {job.scheduled_time?.slice(0, 5) ?? ''}
                      </span>
                    </div>
                    <p className="mt-1.5 text-boyd-light-200">
                      {job.customer_company_name}
                    </p>
                    <p className="text-sm text-boyd-light-400">{job.job_type_name}</p>
                  </Link>
                </li>
              ))}
              {upcoming.length === 0 && (
                <li className="rounded-lg border border-boyd-navy-700 p-4 text-center text-sm text-boyd-light-500">
                  Nothing else scheduled today.
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      <Link
        href="/driver/record"
        className="mt-8 block rounded-lg border border-boyd-navy-600 px-4 py-4 text-center font-semibold text-boyd-light-200 active:bg-boyd-navy-800"
      >
        Record fuel, an expense, or something that went wrong
      </Link>

      <section className="mt-6 rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 p-4">
        <div className="flex items-center gap-2">
          <DataBadge kind="UNAVAILABLE" />
          <span className="text-sm font-semibold text-boyd-light-300">
            GPS NOT CONNECTED
          </span>
        </div>
        <p className="mt-2 text-xs text-boyd-light-500">
          Location is not tracked. Nothing here is simulated.
        </p>
      </section>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="w-full rounded-lg border border-boyd-navy-700 px-4 py-3 text-sm text-boyd-light-400 active:bg-boyd-navy-800"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
