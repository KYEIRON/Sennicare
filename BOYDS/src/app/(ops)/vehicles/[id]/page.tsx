import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import {
  listMaintenance,
  listVehicleCostEntries,
  vehicleMilesInWindow,
} from '@/database/operations';
import { EmptyState, KpiCard, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { Figure } from '@/components/ui/figure';
import { formatCents, formatMiles } from '@/lib/format';
import { cents, milesTenths } from '@/types/branded';
import {
  deriveCostPerMile,
  isComprehensive,
  type VehicleCostEntryRow,
} from '@/services/finance/vehicle-costs';
import { VEHICLE_COST_LINES } from '@/types/economics';
import { CostEntryForm } from './cost-entry-form';
import { MaintenanceForm } from './maintenance-form';
import { CostInclusionToggle } from './cost-inclusion-toggle';

export const metadata: Metadata = { title: 'Vehicle' };

function NotConfigured() {
  return <DataBadge kind="NOT_CONFIGURED" />;
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!vehicle) notFound();

  // True cost per mile is derived over the last twelve months, from real
  // recorded costs and real recorded mileage. Nothing is assumed.
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);

  const [costsResult, maintenanceResult, milesTenthsInWindow] = await Promise.all([
    listVehicleCostEntries(supabase, id),
    listMaintenance(supabase),
    vehicleMilesInWindow(
      supabase,
      id,
      from.toISOString().slice(0, 10),
      to.toISOString().slice(0, 10),
    ),
  ]);

  const costs = costsResult.ok ? costsResult.value : [];
  const maintenance = (maintenanceResult.ok ? maintenanceResult.value : []).filter(
    (record) => record.vehicleId === id,
  );

  const entries: VehicleCostEntryRow[] = costs.map((cost) => ({
    cost_line: cost.costLine as VehicleCostEntryRow['cost_line'],
    period: cost.period as VehicleCostEntryRow['period'],
    amount_cents: cost.amountCents,
    included_in_cost_per_mile: cost.includedInCostPerMile,
    effective_from: cost.effectiveFrom,
    effective_to: cost.effectiveTo,
  }));

  const costPerMile = deriveCostPerMile(entries, {
    from,
    to,
    milesTenths: milesTenths(milesTenthsInWindow),
  });

  const outstanding = maintenance.filter((record) => record.completedDate === null);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/vehicles" className="text-sm text-boyd-light-400 hover:underline">
            &larr; Fleet
          </Link>
          <h1 className="figure mt-1 text-2xl font-bold text-boyd-light-50">
            {vehicle.vehicle_code}
          </h1>
        </div>
        <span className="rounded bg-boyd-navy-800 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-boyd-light-300">
          {String(vehicle.status).replace(/_/g, ' ')}
        </span>
      </header>

      {/* True cost per mile — the figure every job's profitability rests on. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="True cost per mile"
          accent="orange"
          sublabel="Derived from recorded costs and recorded miles"
        >
          <Figure
            calculation={costPerMile}
            format={(derived) => `${formatCents(derived.costPerMile)} / mi`}
          />
        </KpiCard>

        <KpiCard label="Miles, last 12 months" accent="blue">
          <span className="figure font-semibold text-boyd-light-50">
            {formatMiles(milesTenths(milesTenthsInWindow))}
          </span>
        </KpiCard>

        <KpiCard label="Odometer" accent="neutral">
          <span className="figure font-semibold text-boyd-light-50">
            {vehicle.current_odometer_tenths === null ? (
              <NotConfigured />
            ) : (
              formatMiles(milesTenths(Number(vehicle.current_odometer_tenths)))
            )}
          </span>
        </KpiCard>
      </section>

      {/* What the derived figure does and does not cover. This is the part that
          stops a partial rate being mistaken for the whole picture. */}
      <Panel title="What the cost per mile covers">
        {costPerMile.status === 'OK' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_COST_LINES.map((line) => {
                const included = costPerMile.value.linesIncluded.includes(line);
                return (
                  <span
                    key={line}
                    className={`rounded border px-2.5 py-1 text-xs ${
                      included
                        ? 'border-boyd-positive/40 bg-boyd-positive/10 text-boyd-positive'
                        : 'border-boyd-navy-700 text-boyd-light-500'
                    }`}
                  >
                    {included ? '✓ ' : '— '}
                    {line.replace(/_/g, ' ').toLowerCase()}
                  </span>
                );
              })}
            </div>

            {!isComprehensive(costPerMile.value) && (
              <p className="mt-4 rounded border border-boyd-incomplete/30 bg-boyd-incomplete/5 p-3 text-sm text-boyd-light-300">
                <span className="font-semibold text-boyd-incomplete">
                  This is a partial figure.
                </span>{' '}
                It covers {costPerMile.value.linesIncluded.length} of{' '}
                {VEHICLE_COST_LINES.length} cost lines. It is a real number for those
                lines, and it is not the van&rsquo;s true cost per mile — the missing
                lines are costs BOYD&rsquo;S pays and this figure does not yet see.
              </p>
            )}
          </>
        ) : (
          <div className="text-sm text-boyd-light-400">
            <DataBadge
              kind={
                costPerMile.status === 'NOT_CALCULABLE'
                  ? 'NOT_CALCULABLE'
                  : 'DATA_INCOMPLETE'
              }
            />
            <p className="mt-3">
              {costPerMile.status === 'NOT_CALCULABLE'
                ? 'No completed jobs with recorded mileage in the last twelve months, so there are no miles to divide by.'
                : 'No vehicle costs have been recorded yet. Until they are, every job shows vehicle cost as MISSING rather than assuming the van runs for free — which would make every job look more profitable than it is.'}
            </p>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel title={`Recorded costs (${costs.length})`}>
            {costs.length === 0 ? (
              <EmptyState>
                No costs recorded. Insurance, finance and registration are the usual
                starting points — you will have those on paperwork already.
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] tracking-wider text-boyd-light-400 uppercase">
                    <tr className="border-b border-boyd-navy-800">
                      <th className="pb-2 pr-3 font-semibold">Cost</th>
                      <th className="pb-2 pr-3 font-semibold">Amount</th>
                      <th className="pb-2 pr-3 font-semibold">Period</th>
                      <th className="pb-2 pr-3 font-semibold">From</th>
                      <th className="pb-2 font-semibold">In cost per mile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((cost) => (
                      <tr key={cost.id} className="border-b border-boyd-navy-800/60">
                        <td className="py-2.5 pr-3 text-boyd-light-200">
                          {cost.costLine.replace(/_/g, ' ').toLowerCase()}
                        </td>
                        <td className="figure py-2.5 pr-3 text-boyd-light-100">
                          {formatCents(cents(cost.amountCents))}
                        </td>
                        <td className="py-2.5 pr-3 text-boyd-light-400">
                          {cost.period.replace(/_/g, ' ').toLowerCase()}
                        </td>
                        <td className="figure py-2.5 pr-3 text-boyd-light-400">
                          {cost.effectiveFrom}
                        </td>
                        <td className="py-2.5">
                          <CostInclusionToggle
                            entryId={cost.id}
                            vehicleId={id}
                            included={cost.includedInCostPerMile}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title={`Maintenance (${outstanding.length} outstanding)`}>
            {maintenance.length === 0 ? (
              <EmptyState>Nothing scheduled or recorded.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {maintenance.map((record) => (
                  <li
                    key={record.id}
                    className={`rounded border p-3 ${
                      record.completedDate === null
                        ? 'border-boyd-warning/30 bg-boyd-warning/5'
                        : 'border-boyd-navy-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-boyd-light-100">
                        {record.maintenanceType.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <span className="figure text-xs text-boyd-light-400">
                        {record.completedDate
                          ? `Done ${record.completedDate}`
                          : record.dueDate
                            ? `Due ${record.dueDate}`
                            : record.dueOdometerTenths
                              ? `Due at ${formatMiles(milesTenths(record.dueOdometerTenths))}`
                              : ''}
                      </span>
                    </div>
                    {record.description && (
                      <p className="mt-1 text-xs text-boyd-light-400">
                        {record.description}
                      </p>
                    )}
                    <p className="figure mt-1 text-xs text-boyd-light-400">
                      {record.costCents === null ? (
                        record.completedDate ? (
                          <DataBadge
                            kind="DATA_INCOMPLETE"
                            title="Done, but not yet priced — so it does not count towards cost per mile"
                          />
                        ) : (
                          ''
                        )
                      ) : (
                        formatCents(cents(record.costCents))
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Record a cost">
            <CostEntryForm vehicleId={id} />
          </Panel>

          <Panel title="Maintenance">
            <MaintenanceForm vehicleId={id} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
