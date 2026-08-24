import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDriver } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { allowedTransitionsFrom } from '@/services/jobs/state-machine';
import type { JobStatus } from '@/types/operations';
import { DriverJobActions } from './driver-job-actions';

export const metadata: Metadata = { title: 'Job' };

/** Statuses the driver themselves drives. Nothing commercial appears here. */
const DRIVER_TRANSITIONS: readonly JobStatus[] = [
  'DRIVER_ACCEPTED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DELIVERY',
  'DELIVERED',
  'FAILED',
];

interface Stop {
  id: string;
  sequence: number;
  stop_type: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  contact_name: string | null;
  contact_phone: string | null;
  instructions: string | null;
}

export default async function DriverJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await requireDriver();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  // Read through driver_jobs, which has no financial columns in it at all.
  const [{ data: job }, { data: stops }] = await Promise.all([
    supabase.from('driver_jobs').select('*').eq('id', id).maybeSingle(),
    supabase.from('job_stops').select('*').eq('job_id', id).order('sequence'),
  ]);

  if (!job) notFound();

  const available = allowedTransitionsFrom(job.status as JobStatus).filter((t) =>
    DRIVER_TRANSITIONS.includes(t.to),
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link href="/driver/today" className="text-sm text-boyd-light-400">
        &larr; Today
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="figure text-xl font-bold text-boyd-light-50">
            {job.job_number}
          </h1>
          <span className="rounded bg-boyd-navy-800 px-2.5 py-1 text-[11px] font-bold tracking-wider text-boyd-light-300">
            {job.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="mt-1 text-lg text-boyd-light-200">{job.customer_company_name}</p>
        <p className="text-sm text-boyd-light-400">{job.job_type_name}</p>
      </header>

      {job.special_handling && (
        <div className="mt-4 rounded-lg border border-boyd-warning/40 bg-boyd-warning/10 p-4">
          <p className="text-xs font-bold tracking-wider text-boyd-warning uppercase">
            Special handling
          </p>
          <p className="mt-1 text-sm text-boyd-light-200">{job.special_handling}</p>
        </div>
      )}

      <ol className="mt-6 space-y-4">
        {((stops ?? []) as Stop[]).map((stop) => (
          <li
            key={stop.id}
            className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 p-5"
          >
            <p className="text-xs font-bold tracking-wider text-boyd-orange-400 uppercase">
              {stop.stop_type}
            </p>
            <p className="mt-2 text-lg text-boyd-light-100">{stop.address_line1}</p>
            {stop.address_line2 && (
              <p className="text-boyd-light-300">{stop.address_line2}</p>
            )}
            <p className="text-boyd-light-300">
              {stop.city}, {stop.state} {stop.zip}
            </p>

            {stop.instructions && (
              <p className="mt-3 rounded border border-boyd-navy-700 p-3 text-sm text-boyd-light-300">
                {stop.instructions}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(
                  `${stop.address_line1}, ${stop.city}, ${stop.state} ${stop.zip}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-boyd-blue-600 px-4 py-3.5 text-center font-semibold text-white active:bg-boyd-blue-500"
              >
                Navigate
              </a>
              {stop.contact_phone && (
                <a
                  href={`tel:${stop.contact_phone}`}
                  className="flex-1 rounded-lg border border-boyd-navy-600 px-4 py-3.5 text-center font-semibold text-boyd-light-200 active:bg-boyd-navy-800"
                >
                  Call {stop.contact_name ?? 'contact'}
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <DriverJobActions jobId={id} transitions={available} />
    </div>
  );
}
