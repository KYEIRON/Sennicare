import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import {
  listCustomers,
  listJobsForProfitability,
  listVehicles,
} from '@/database/operations';
import { EmptyState, KpiCard, Panel } from '@/components/ui/kpi-card';
import { Figure } from '@/components/ui/figure';
import { DataBadge } from '@/components/ui/data-badge';
import { formatBps, formatCents, formatMiles } from '@/lib/format';
import {
  averageContributionPerJob,
  calculateProfitability,
  contributionMargin,
  contributionPerMile,
  emptyMileageShare,
  jobsBlockingProfitability,
  lossMakingJobs,
  profitabilityByCustomer,
  profitabilityByVehicle,
  type ProfitabilityJob,
} from '@/services/finance/profitability';

export const metadata: Metadata = { title: 'Reports' };

/**
 * BOYD'S reporting.
 *
 * Every figure is on the ACTUAL basis — these are numbers a partner makes
 * decisions on, so an estimate is not good enough. Where a figure cannot be
 * stated, the page says which jobs are blocking it rather than showing a
 * plausible total.
 */
export default async function ReportsPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [jobsResult, customersResult, vehiclesResult] = await Promise.all([
    listJobsForProfitability(supabase),
    listCustomers(supabase),
    listVehicles(supabase),
  ]);

  const jobs = (jobsResult.ok ? jobsResult.value : []) as unknown as ProfitabilityJob[];
  const customerNames = new Map(
    (customersResult.ok ? customersResult.value : []).map((c) => [c.id, c.companyName]),
  );
  const vehicleCodes = new Map(
    (vehiclesResult.ok ? vehiclesResult.value : []).map((v) => [v.id, v.vehicleCode]),
  );

  const overall = calculateProfitability(jobs);
  const byCustomer = profitabilityByCustomer(jobs);
  const byVehicle = profitabilityByVehicle(jobs);
  const losses = lossMakingJobs(jobs);
  const blocking = jobsBlockingProfitability(jobs);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Revenue" accent="positive">
          <Figure calculation={overall} format={(v) => formatCents(v.revenue)} />
        </KpiCard>
        <KpiCard label="Total cost" accent="orange">
          <Figure calculation={overall} format={(v) => formatCents(v.totalCost)} />
        </KpiCard>
        <KpiCard label="Contribution" accent="positive">
          <Figure calculation={overall} format={(v) => formatCents(v.contribution)} />
        </KpiCard>
        <KpiCard label="Per job" accent="blue">
          <Figure calculation={averageContributionPerJob(overall)} format={formatCents} />
        </KpiCard>
        <KpiCard label="Per mile" accent="blue">
          <Figure calculation={contributionPerMile(overall)} format={formatCents} />
        </KpiCard>
        <KpiCard label="Margin" accent="blue">
          <Figure calculation={contributionMargin(overall)} format={formatBps} />
        </KpiCard>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Total miles" accent="neutral">
          <Figure calculation={overall} format={(v) => formatMiles(v.totalMiles)} />
        </KpiCard>
        <KpiCard label="Empty miles" accent="orange">
          <Figure calculation={overall} format={(v) => formatMiles(v.emptyMiles)} />
        </KpiCard>
        <KpiCard
          label="Empty mileage"
          accent="orange"
          sublabel="Miles driven without a load"
        >
          <Figure calculation={emptyMileageShare(overall)} format={formatBps} />
        </KpiCard>
      </section>

      {blocking.length > 0 && (
        <Panel title={`Blocking these figures (${blocking.length})`}>
          <p className="mb-3 text-sm text-boyd-light-400">
            These jobs are complete but missing cost or mileage data. Until they are
            recorded, BOYD&rsquo;S cannot state the figures above — so it does not.
          </p>
          <ul className="space-y-2">
            {blocking.map(({ job, missing }) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-boyd-incomplete/30 bg-boyd-incomplete/5 p-3"
              >
                <Link
                  href={`/jobs/${job.id}`}
                  className="figure text-sm font-semibold text-boyd-light-100 hover:text-boyd-blue-300"
                >
                  {job.job_number}
                </Link>
                <span className="text-xs text-boyd-light-400">
                  Missing {missing.join(', ').replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Customer profitability">
          {byCustomer.length === 0 ? (
            <EmptyState>No completed jobs yet.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] tracking-wider text-boyd-light-400 uppercase">
                  <tr className="border-b border-boyd-navy-800">
                    <th className="pb-2 pr-3 font-semibold">Customer</th>
                    <th className="pb-2 pr-3 font-semibold">Jobs</th>
                    <th className="pb-2 pr-3 font-semibold">Revenue</th>
                    <th className="pb-2 font-semibold">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {byCustomer.map((group) => (
                    <tr key={group.key} className="border-b border-boyd-navy-800/60">
                      <td className="py-2.5 pr-3 text-boyd-light-100">
                        {customerNames.get(group.key) ?? 'Unknown'}
                      </td>
                      <td className="figure py-2.5 pr-3 text-boyd-light-400">
                        {group.result.status === 'OK' ? group.result.value.jobCount : '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Figure
                          calculation={group.result}
                          format={(v) => formatCents(v.revenue)}
                        />
                      </td>
                      <td className="py-2.5">
                        <Figure
                          calculation={group.result}
                          format={(v) => formatCents(v.contribution)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Vehicle profitability">
          {byVehicle.length === 0 ? (
            <EmptyState>No completed jobs yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {byVehicle.map((group) => (
                <li key={group.key} className="rounded border border-boyd-navy-700 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="figure font-semibold text-boyd-light-100">
                      {vehicleCodes.get(group.key) ?? 'Unknown'}
                    </span>
                    <Figure
                      calculation={group.result}
                      format={(v) => formatCents(v.contribution)}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-boyd-light-400">
                    <span>
                      Miles:{' '}
                      <Figure
                        calculation={group.result}
                        format={(v) => formatMiles(v.totalMiles)}
                      />
                    </span>
                    <span>
                      Empty:{' '}
                      <Figure
                        calculation={emptyMileageShare(group.result)}
                        format={formatBps}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={`Jobs that lost money (${losses.length})`}>
        {losses.length === 0 ? (
          <EmptyState>
            No completed job with full cost data lost money.
            {blocking.length > 0 &&
              ' Jobs with missing costs are not counted either way.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {losses.map(({ job, contribution }) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-boyd-negative/30 bg-boyd-negative/5 p-3"
              >
                <Link
                  href={`/jobs/${job.id}`}
                  className="figure text-sm font-semibold text-boyd-light-100 hover:text-boyd-blue-300"
                >
                  {job.job_number}
                </Link>
                <span className="figure font-semibold text-boyd-negative">
                  {formatCents(contribution)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-boyd-light-500">
          Only jobs with complete cost data appear here. A job whose costs are unknown is
          not a profitable job — it is an unmeasured one, and it is listed above instead.
        </p>
      </Panel>

      <Panel title="What these figures rest on">
        <ul className="space-y-2 text-sm text-boyd-light-400">
          <li className="flex items-start gap-2">
            <DataBadge kind="NOT_CONFIGURED" />
            <span>
              Minimum contribution and target margin are not set, so BOYD&rsquo;S cannot
              yet tell you whether a job cleared its floor — only what it earned.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <DataBadge kind="NOT_CONFIGURED" />
            <span>
              The driver labour cost basis is not set. Where a driver cost is recorded it
              is included; where it is not, contribution reports DATA INCOMPLETE rather
              than assuming labour was free.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <DataBadge kind="NOT_CONFIGURED" />
            <span>
              Vehicle cost per mile is derived from recorded vehicle costs. With none
              recorded, vehicle allocation stays MISSING — a van with no recorded costs
              did not run for free.
            </span>
          </li>
        </ul>
      </Panel>
    </div>
  );
}
