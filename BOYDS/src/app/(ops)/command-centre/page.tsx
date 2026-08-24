import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listJobs, listVehicles, listDrivers } from '@/database/operations';
import {
  activeJobs,
  emptyMileagePercentage,
  jobsWithMissingCosts,
  needsAttention,
  totalContribution,
  totalCostAcrossJobs,
  totalMiles,
  totalRevenue,
  type SummaryJob,
} from '@/features/command-centre/summary';
import { EmptyState, KpiCard, Panel } from '@/components/ui/kpi-card';
import { Figure } from '@/components/ui/figure';
import { DataBadge } from '@/components/ui/data-badge';
import { formatBps, formatCents, formatMiles } from '@/lib/format';
import { operatingDateKey } from '@/lib/datetime';
import { NOT_CONFIGURED_LABEL } from '@/lib/format';

export const metadata: Metadata = { title: 'Command Centre' };

/**
 * The BOYD'S Command Centre.
 *
 * Follows the supplied dashboard design for layout, hierarchy and KPI
 * presentation. Every figure is real BOYD'S data or an explicit label — none of
 * the design reference's illustrative numbers appear here or anywhere else.
 */
export default async function CommandCentrePage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const today = operatingDateKey(new Date());

  const [jobsResult, vehiclesResult, driversResult] = await Promise.all([
    listJobs(supabase),
    listVehicles(supabase),
    listDrivers(supabase),
  ]);

  const allJobs = jobsResult.ok ? jobsResult.value : [];
  const vehicles = vehiclesResult.ok ? vehiclesResult.value : [];
  const drivers = driversResult.ok ? driversResult.value : [];

  const todaysJobs = allJobs.filter(
    (job) => job.scheduled_date === today,
  ) as unknown as SummaryJob[];
  const completedToday = todaysJobs.filter((job) => job.status === 'COMPLETED');

  const live = activeJobs(allJobs as unknown as SummaryJob[]);
  const attention = needsAttention(allJobs as unknown as SummaryJob[]);
  const missingCosts = jobsWithMissingCosts(allJobs as unknown as SummaryJob[]);

  const unassigned = allJobs.filter(
    (job) =>
      (job.status === 'APPROVED' || job.status === 'SCHEDULED') &&
      (!job.vehicle_id || !job.driver_id),
  );

  return (
    <div className="space-y-4">
      {/* Today's figures. Revenue and contribution are computed on the ACTUAL
          basis: these are numbers a partner may make a decision on, so an
          estimate is not good enough. */}
      <section
        aria-label="Today"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6"
      >
        <KpiCard label="Today's revenue" accent="positive">
          <Figure calculation={totalRevenue(completedToday)} format={formatCents} />
        </KpiCard>

        <KpiCard label="Today's contribution" accent="positive">
          <Figure calculation={totalContribution(completedToday)} format={formatCents} />
        </KpiCard>

        <KpiCard label="Today's costs" accent="orange">
          <Figure
            calculation={totalCostAcrossJobs(completedToday)}
            format={formatCents}
          />
        </KpiCard>

        <KpiCard label="Active jobs" accent="blue">
          <span className="figure font-semibold text-boyd-light-50">{live.length}</span>
        </KpiCard>

        <KpiCard label="Today's miles" accent="blue">
          <Figure calculation={totalMiles(completedToday)} format={formatMiles} />
        </KpiCard>

        <KpiCard
          label="Empty mileage"
          accent="orange"
          sublabel="Share of miles driven without a load"
        >
          <Figure
            calculation={emptyMileagePercentage(completedToday)}
            format={formatBps}
          />
        </KpiCard>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Live operations. The mockup shows a live map; BOYD'S has no maps or
            GPS integration, so this says so rather than drawing a fake van. */}
        <Panel title="Live operations">
          <div className="rounded border border-dashed border-boyd-navy-700 bg-boyd-navy-950 p-6 text-center">
            <DataBadge kind="UNAVAILABLE" />
            <p className="mt-3 text-sm text-boyd-light-400">
              Live tracking unavailable — no maps provider is connected.
            </p>
            <p className="mt-1 text-xs text-boyd-light-500">
              Vehicle positions will appear here once a maps provider is configured.
              Nothing is simulated in the meantime.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {live.length === 0 ? (
              <EmptyState>No jobs are out on the road right now.</EmptyState>
            ) : (
              live.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block rounded border border-boyd-navy-700 p-3 transition-colors hover:border-boyd-blue-500"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="figure text-sm font-semibold text-boyd-light-100">
                      {job.job_number}
                    </span>
                    <span className="rounded bg-boyd-blue-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-blue-300">
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Panel>

        {/* Needs attention */}
        <Panel
          title="Needs attention"
          action={
            <Link href="/jobs" className="text-xs text-boyd-blue-300 hover:underline">
              All jobs
            </Link>
          }
        >
          {attention.length === 0 &&
          missingCosts.length === 0 &&
          unassigned.length === 0 ? (
            <EmptyState>Nothing is waiting on a decision.</EmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              {unassigned.length > 0 && (
                <li className="rounded border border-boyd-warning/30 bg-boyd-warning/5 p-3">
                  <Link href="/dispatch" className="font-semibold text-boyd-warning">
                    {unassigned.length} job{unassigned.length === 1 ? '' : 's'} awaiting
                    dispatch
                  </Link>
                </li>
              )}
              {attention.map((job) => (
                <li key={job.id} className="rounded border border-boyd-navy-700 p-3">
                  <Link href={`/jobs/${job.id}`} className="text-boyd-light-200">
                    <span className="figure font-semibold">{job.job_number}</span>
                    <span className="ml-2 text-xs text-boyd-light-400">
                      {job.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </Link>
                </li>
              ))}
              {missingCosts.map(({ job, missing }) => (
                <li
                  key={job.id}
                  className="rounded border border-boyd-incomplete/30 bg-boyd-incomplete/5 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="figure text-sm font-semibold text-boyd-light-200">
                      {job.job_number}
                    </span>
                    <DataBadge kind="DATA_INCOMPLETE" />
                  </div>
                  <p className="mt-1 text-xs text-boyd-light-400">
                    Completed, but missing {missing.join(', ').replace(/_/g, ' ')}.
                    Contribution cannot be calculated until it is recorded.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Fleet and drivers */}
        <Panel title="Fleet and drivers">
          {vehicles.length === 0 ? (
            <EmptyState>No vehicles have been added yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {vehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="flex items-center justify-between gap-3 rounded border border-boyd-navy-700 p-3"
                >
                  <div>
                    <p className="figure text-sm font-semibold text-boyd-light-100">
                      {vehicle.vehicleCode}
                    </p>
                    <p className="text-xs text-boyd-light-400">
                      {vehicle.make && vehicle.model ? (
                        `${vehicle.make} ${vehicle.model}`
                      ) : (
                        <span className="text-boyd-light-500">
                          {NOT_CONFIGURED_LABEL}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                    {vehicle.status.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <ul className="mt-3 space-y-2">
            {drivers.map((driver) => (
              <li
                key={driver.id}
                className="flex items-center justify-between gap-3 rounded border border-boyd-navy-700 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-boyd-light-100">
                    {driver.firstName}
                  </p>
                  <p className="text-xs text-boyd-light-400">
                    {driver.currentLocation ?? 'Location not recorded'}
                  </p>
                </div>
                <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                  {driver.availability.replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Business policy that has not been decided yet. Shown plainly rather
          than hidden, because these gaps limit what the system can tell BOYD'S. */}
      <Panel title="Business settings">
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Minimum contribution per job',
            'Target contribution margin',
            'Driver labour cost basis',
            'Vehicle cost allocation basis',
          ].map((setting) => (
            <div key={setting} className="rounded border border-boyd-navy-700 p-3">
              <p className="text-xs text-boyd-light-400">{setting}</p>
              <div className="mt-1.5">
                <DataBadge kind="NOT_CONFIGURED" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-boyd-light-500">
          These are business decisions for the partners. Until they are made, BOYD&rsquo;S
          shows NOT CONFIGURED rather than assuming a value.
        </p>
      </Panel>
    </div>
  );
}
