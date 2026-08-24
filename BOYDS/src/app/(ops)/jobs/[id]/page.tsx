import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { JOB_COLUMNS, type JobRow } from '@/database/operations';
import { Panel } from '@/components/ui/kpi-card';
import { Figure } from '@/components/ui/figure';
import { DataBadge } from '@/components/ui/data-badge';
import { formatBps, formatCents, formatMiles } from '@/lib/format';
import { milesTenths } from '@/types/branded';
import {
  calculateContribution,
  calculateContributionMargin,
  calculateContributionPerMile,
  calculateEmptyMileage,
  calculateTotalCost,
  costInputsFromRow,
  JOB_COST_FIELDS,
} from '@/services/finance/job-costs';
import { allowedTransitionsFrom } from '@/services/jobs/state-machine';
import type { JobStatus } from '@/types/operations';
import { JobActions } from './job-actions';

export const metadata: Metadata = { title: 'Job' };

interface Stop {
  id: string;
  sequence: number;
  stop_type: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  contact_name: string | null;
  contact_phone: string | null;
  instructions: string | null;
  scheduled_time: string | null;
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [{ data: job }, { data: stops }] = await Promise.all([
    supabase.from('jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('job_stops').select('*').eq('job_id', id).order('sequence'),
  ]);

  if (!job) notFound();

  const row = job as unknown as JobRow;
  const inputs = costInputsFromRow(row);

  const contribution = calculateContribution(inputs, 'ACTUAL');
  const totalCost = calculateTotalCost(inputs, 'ACTUAL');
  const perMile = calculateContributionPerMile(inputs, 'ACTUAL');
  const margin = calculateContributionMargin(inputs, 'ACTUAL');
  const emptyMileage = calculateEmptyMileage(inputs);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="figure text-2xl font-bold text-boyd-light-50">
            {row.job_number}
          </h1>
          <span className="rounded bg-boyd-navy-800 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-boyd-light-300">
            {row.status.replace(/_/g, ' ')}
          </span>
          {row.provenance === 'DEMO' && <DataBadge kind="DEMO_DATA" />}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Route">
          <ol className="space-y-3">
            {((stops ?? []) as Stop[]).map((stop) => (
              <li key={stop.id} className="rounded border border-boyd-navy-700 p-3">
                <p className="text-[11px] font-semibold tracking-wider text-boyd-orange-400 uppercase">
                  {stop.stop_type}
                </p>
                <p className="mt-1 text-sm text-boyd-light-100">{stop.address_line1}</p>
                <p className="text-sm text-boyd-light-400">
                  {stop.city}, {stop.state} {stop.zip}
                </p>
                {stop.contact_name && (
                  <p className="mt-1.5 text-xs text-boyd-light-400">
                    {stop.contact_name}
                    {stop.contact_phone ? ` · ${stop.contact_phone}` : ''}
                  </p>
                )}
                {stop.instructions && (
                  <p className="mt-1.5 text-xs text-boyd-light-500">
                    {stop.instructions}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Panel>

        {/* Profitability, on the ACTUAL basis. These are figures a partner may
            make a decision on, so an estimate is not good enough. */}
        <Panel title="Profitability">
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-boyd-light-400">Revenue</dt>
              <dd className="figure font-semibold text-boyd-light-50">
                {row.won_price_cents === null ? (
                  <DataBadge kind="DATA_INCOMPLETE" title="No agreed price recorded" />
                ) : (
                  formatCents(row.won_price_cents as never)
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-boyd-light-400">Total cost</dt>
              <dd>
                <Figure calculation={totalCost} format={(v) => formatCents(v.total)} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-boyd-navy-800 pt-3">
              <dt className="font-semibold text-boyd-light-300">Contribution</dt>
              <dd>
                <Figure
                  calculation={contribution}
                  format={(v) => formatCents(v.contribution)}
                />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-boyd-light-400">Per mile</dt>
              <dd>
                <Figure calculation={perMile} format={formatCents} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-boyd-light-400">Margin</dt>
              <dd>
                <Figure calculation={margin} format={formatBps} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-boyd-light-400">Empty mileage</dt>
              <dd>
                <Figure calculation={emptyMileage} format={formatBps} />
              </dd>
            </div>
          </dl>
        </Panel>

        {/* Estimated against actual, side by side. Neither replaces the other. */}
        <Panel title="Estimated and actual costs">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] tracking-wider text-boyd-light-400 uppercase">
              <tr className="border-b border-boyd-navy-800">
                <th className="pb-2 font-semibold">Cost</th>
                <th className="pb-2 text-right font-semibold">Estimated</th>
                <th className="pb-2 text-right font-semibold">Actual</th>
              </tr>
            </thead>
            <tbody>
              {JOB_COST_FIELDS.map((field) => {
                const line = inputs.costs[field];
                return (
                  <tr key={field} className="border-b border-boyd-navy-800/60">
                    <td className="py-2 text-boyd-light-300">
                      {field.replace(/_/g, ' ').replace('cost', '').trim()}
                    </td>
                    <td className="figure py-2 text-right text-boyd-light-400">
                      {line.estimated === null ? '—' : formatCents(line.estimated)}
                    </td>
                    <td className="figure py-2 text-right text-boyd-light-100">
                      {line.actual === null ? (
                        <DataBadge kind="DATA_INCOMPLETE" />
                      ) : (
                        formatCents(line.actual)
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="py-2 text-boyd-light-300">miles</td>
                <td className="figure py-2 text-right text-boyd-light-400">
                  {row.estimated_miles_tenths === null
                    ? '—'
                    : formatMiles(milesTenths(row.estimated_miles_tenths))}
                </td>
                <td className="figure py-2 text-right text-boyd-light-100">
                  {row.actual_miles_tenths === null ? (
                    <DataBadge kind="DATA_INCOMPLETE" />
                  ) : (
                    formatMiles(milesTenths(row.actual_miles_tenths))
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <JobActions
        jobId={row.id}
        transitions={allowedTransitionsFrom(row.status as JobStatus)}
      />
    </div>
  );
}
