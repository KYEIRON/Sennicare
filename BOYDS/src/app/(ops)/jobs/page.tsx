import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listCustomers, listJobs, listJobTypes } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { Figure } from '@/components/ui/figure';
import { formatCents } from '@/lib/format';
import { calculateContribution, costInputsFromRow } from '@/services/finance/job-costs';
import { NewJobForm } from './new-job-form';

export const metadata: Metadata = { title: 'Jobs' };

export default async function JobsPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [jobsResult, customersResult, typesResult] = await Promise.all([
    listJobs(supabase),
    listCustomers(supabase),
    listJobTypes(supabase),
  ]);

  const jobs = jobsResult.ok ? jobsResult.value : [];
  const customers = customersResult.ok ? customersResult.value : [];
  const jobTypes = typesResult.ok ? typesResult.value : [];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <Panel title={`Jobs (${jobs.length})`}>
          {jobs.length === 0 ? (
            <EmptyState>No jobs yet. Create one using the form.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] tracking-wider text-boyd-light-400 uppercase">
                  <tr className="border-b border-boyd-navy-800">
                    <th className="pb-2 pr-3 font-semibold">Job</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 pr-3 font-semibold">Scheduled</th>
                    <th className="pb-2 pr-3 font-semibold">Revenue</th>
                    <th className="pb-2 font-semibold">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const contribution = calculateContribution(
                      costInputsFromRow(job),
                      'ACTUAL',
                    );

                    return (
                      <tr key={job.id} className="border-b border-boyd-navy-800/60">
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="figure font-semibold text-boyd-light-100 hover:text-boyd-blue-300"
                          >
                            {job.job_number}
                          </Link>
                          {job.provenance === 'DEMO' && (
                            <span className="ml-2">
                              <DataBadge kind="DEMO_DATA" />
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                            {job.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="figure py-2.5 pr-3 text-boyd-light-400">
                          {job.scheduled_date ?? '—'}
                          {job.scheduled_time ? ` ${job.scheduled_time.slice(0, 5)}` : ''}
                        </td>
                        <td className="figure py-2.5 pr-3 text-boyd-light-200">
                          {job.won_price_cents === null ? (
                            <span className="text-boyd-light-500">—</span>
                          ) : (
                            formatCents(job.won_price_cents as never)
                          )}
                        </td>
                        <td className="py-2.5">
                          <Figure
                            calculation={contribution}
                            format={(value) => formatCents(value.contribution)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="New job">
        <NewJobForm customers={customers} jobTypes={jobTypes} />
      </Panel>
    </div>
  );
}
