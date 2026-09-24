import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listVehicles } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { formatMiles } from '@/lib/format';
import { milesTenths } from '@/types/branded';
import Link from 'next/link';
import { VehicleForm } from './vehicle-form';

export const metadata: Metadata = { title: 'Vehicles' };

/** A value BOYD'S has not supplied yet. Never blank, never invented. */
function NotConfigured() {
  return <DataBadge kind="NOT_CONFIGURED" />;
}

export default async function VehiclesPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const result = await listVehicles(supabase);
  const vehicles = result.ok ? result.value : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Panel title={`Fleet (${vehicles.length})`}>
          {vehicles.length === 0 ? (
            <EmptyState>
              No vehicles yet. Add BOYD-001 here — leave any specification you do not have
              to hand blank rather than guessing it.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id} className="rounded border border-boyd-navy-700 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="figure text-lg font-bold text-boyd-light-50">
                        <Link
                          href={`/vehicles/${vehicle.id}`}
                          className="hover:text-boyd-blue-300"
                        >
                          {vehicle.vehicleCode}
                        </Link>
                      </h3>
                      {vehicle.provenance === 'DEMO' && <DataBadge kind="DEMO_DATA" />}
                    </div>
                    <span className="rounded bg-boyd-navy-800 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-boyd-light-300">
                      {vehicle.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-boyd-light-400">Make and model</dt>
                      <dd className="text-boyd-light-200">
                        {vehicle.make && vehicle.model ? (
                          `${vehicle.make} ${vehicle.model}`
                        ) : (
                          <NotConfigured />
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-boyd-light-400">Year</dt>
                      <dd className="figure text-boyd-light-200">
                        {vehicle.year ?? <NotConfigured />}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-boyd-light-400">Plate</dt>
                      <dd className="figure text-boyd-light-200">
                        {vehicle.licensePlate ?? <NotConfigured />}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-boyd-light-400">Odometer</dt>
                      <dd className="figure text-boyd-light-200">
                        {vehicle.currentOdometerTenths === null ? (
                          <NotConfigured />
                        ) : (
                          formatMiles(milesTenths(vehicle.currentOdometerTenths))
                        )}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-boyd-light-400">Insurance renewal</dt>
                      <dd className="figure text-boyd-light-200">
                        {vehicle.insuranceRenewalDate ?? <NotConfigured />}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Add a vehicle">
        <VehicleForm />
      </Panel>
    </div>
  );
}
