import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listDrivers, listJobs, listVehicles } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { isDriverAssignable, isVehicleAssignable } from '@/services/dispatch/conflicts';
import { AssignForm } from './assign-form';
import { UnassignButton } from './unassign-button';

export const metadata: Metadata = { title: 'Dispatch' };

export default async function DispatchPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [jobsResult, vehiclesResult, driversResult] = await Promise.all([
    listJobs(supabase),
    listVehicles(supabase),
    listDrivers(supabase),
  ]);

  const jobs = jobsResult.ok ? jobsResult.value : [];
  const vehicles = vehiclesResult.ok ? vehiclesResult.value : [];
  const drivers = driversResult.ok ? driversResult.value : [];

  const awaitingDispatch = jobs.filter(
    (job) => job.status === 'APPROVED' || job.status === 'SCHEDULED',
  );
  const assigned = jobs.filter((job) =>
    ['ASSIGNED', 'DRIVER_ACCEPTED'].includes(job.status),
  );

  const assignableVehicles = vehicles.filter((vehicle) =>
    isVehicleAssignable({
      id: vehicle.id,
      vehicleCode: vehicle.vehicleCode,
      status: vehicle.status,
      active: vehicle.active,
    }),
  );

  const assignableDrivers = drivers.filter((driver) =>
    isDriverAssignable({
      id: driver.id,
      status: driver.status,
      availability: driver.availability,
      active: driver.active,
    }),
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Panel title={`Awaiting dispatch (${awaitingDispatch.length})`}>
          {awaitingDispatch.length === 0 ? (
            <EmptyState>Nothing is waiting to be dispatched.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {awaitingDispatch.map((job) => (
                <li key={job.id} className="rounded border border-boyd-navy-700 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="figure font-semibold text-boyd-light-100">
                      {job.job_number}
                    </span>
                    <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                      {job.status}
                    </span>
                  </div>
                  {job.description && (
                    <p className="mt-1 text-sm text-boyd-light-400">{job.description}</p>
                  )}
                  <div className="mt-3">
                    <AssignForm
                      jobId={job.id}
                      vehicles={assignableVehicles}
                      drivers={assignableDrivers}
                      defaultDate={job.scheduled_date}
                      defaultTime={job.scheduled_time}
                      defaultWindowEnd={job.scheduled_window_end}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Assigned (${assigned.length})`}>
          {assigned.length === 0 ? (
            <EmptyState>No jobs are currently assigned.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {assigned.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-boyd-navy-700 p-3"
                >
                  <div>
                    <span className="figure font-semibold text-boyd-light-100">
                      {job.job_number}
                    </span>
                    <span className="ml-3 figure text-sm text-boyd-light-400">
                      {job.scheduled_date} {job.scheduled_time?.slice(0, 5)}
                    </span>
                  </div>
                  <UnassignButton jobId={job.id} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Available vehicles">
          {assignableVehicles.length === 0 ? (
            <EmptyState>No vehicles are available for dispatch.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {assignableVehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="flex items-center justify-between gap-2 rounded border border-boyd-navy-700 p-3 text-sm"
                >
                  <span className="figure font-semibold text-boyd-light-100">
                    {vehicle.vehicleCode}
                  </span>
                  <span className="text-xs text-boyd-light-400">
                    {vehicle.status.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Available drivers">
          {assignableDrivers.length === 0 ? (
            <EmptyState>No drivers are available for dispatch.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {assignableDrivers.map((driver) => (
                <li
                  key={driver.id}
                  className="flex items-center justify-between gap-2 rounded border border-boyd-navy-700 p-3 text-sm"
                >
                  <span className="font-semibold text-boyd-light-100">
                    {driver.firstName}
                  </span>
                  <span className="text-xs text-boyd-light-400">
                    {driver.availability.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
