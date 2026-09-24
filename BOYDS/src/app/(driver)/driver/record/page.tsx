import type { Metadata } from 'next';
import Link from 'next/link';
import { requireDriver } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listDriverJobs } from '@/database/operations';
import { operatingDateKey } from '@/lib/datetime';
import { ExpenseForm } from './expense-form';
import { FuelForm } from './fuel-form';
import { IncidentForm } from './incident-form';

export const metadata: Metadata = { title: 'Record' };

/**
 * Where the driver records fuel and expenses.
 *
 * Separate from the job screen because these often happen between jobs — at the
 * pump, at a toll, in a car park — and Moh should not have to open a job to
 * record one.
 */
export default async function DriverRecordPage() {
  const auth = await requireDriver();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const today = operatingDateKey(new Date());
  const result = await listDriverJobs(supabase, today);
  const jobs = result.ok ? result.value : [];

  const { data: driver } = await supabase
    .from('drivers')
    .select('current_vehicle_id')
    .eq('user_id', auth.value.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link href="/driver/today" className="text-sm text-boyd-light-400">
        &larr; Today
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-boyd-light-50">Record</h1>
      <p className="mt-1 text-sm text-boyd-light-400">
        Fuel and expenses go straight onto the job&rsquo;s real cost. Anything that went
        wrong goes to the partners the moment you send it.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold tracking-[0.15em] text-boyd-light-400 uppercase">
          Fuel
        </h2>
        {driver?.current_vehicle_id ? (
          <FuelForm jobs={jobs} />
        ) : (
          <p className="rounded-lg border border-boyd-navy-700 p-4 text-sm text-boyd-light-400">
            No vehicle is assigned to you right now, so fuel cannot be recorded against
            one.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-bold tracking-[0.15em] text-boyd-light-400 uppercase">
          Expense
        </h2>
        <ExpenseForm jobs={jobs} />
      </section>

      <section className="mt-10 border-t border-boyd-navy-700 pt-8">
        <h2 className="mb-1 text-xs font-bold tracking-[0.15em] text-boyd-light-400 uppercase">
          Something went wrong
        </h2>
        <p className="mb-3 text-sm text-boyd-light-400">
          A bump, a breakdown, damaged goods, nobody there, stopped by the police. Report
          it here.
        </p>
        {driver?.current_vehicle_id ? (
          <IncidentForm jobs={jobs} />
        ) : (
          <p className="rounded-lg border border-boyd-navy-700 p-4 text-sm text-boyd-light-400">
            No van is assigned to you right now, so a report cannot be filed against one.
            Call a partner and tell them directly — do not wait.
          </p>
        )}
      </section>
    </div>
  );
}
