import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listDrivers } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';

export const metadata: Metadata = { title: 'Drivers' };

export default async function DriversPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const result = await listDrivers(supabase);
  const drivers = result.ok ? result.value : [];

  return (
    <Panel title={`Drivers (${drivers.length})`}>
      <p className="mb-4 rounded border border-boyd-navy-700 bg-boyd-navy-950 p-3 text-xs text-boyd-light-400">
        A driver record is separate from a partner record. A person may be a partner, a
        driver, both, or neither — being a partner does not make someone a driver.
      </p>

      {drivers.length === 0 ? (
        <EmptyState>No driver records yet.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {drivers.map((driver) => (
            <li key={driver.id} className="rounded border border-boyd-navy-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-boyd-light-50">
                  {driver.firstName} {driver.lastName ?? ''}
                </h3>
                <div className="flex gap-2">
                  <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                    {driver.status}
                  </span>
                  <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                    {driver.availability.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-boyd-light-400">Licence expiry</dt>
                  <dd className="figure text-boyd-light-200">
                    {driver.licenseExpiry ?? <DataBadge kind="NOT_CONFIGURED" />}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-boyd-light-400">Location</dt>
                  <dd className="text-boyd-light-200">
                    {driver.currentLocation ?? (
                      <span className="text-xs text-boyd-light-500">
                        Not recorded — no GPS is connected
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-boyd-light-400">Vehicle</dt>
                  <dd className="text-boyd-light-200">
                    {driver.currentVehicleId ? 'Assigned' : '—'}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
