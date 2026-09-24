'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { assignJobSchema } from '@/validation/operations';
import { findConflicts, type ScheduledJob } from '@/services/dispatch/conflicts';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Assign a vehicle and driver to a job.
 *
 * Conflicts are checked here so a partner sees every problem in plain language,
 * and again by the database, which is what actually prevents a double booking.
 */
export async function assignJob(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');
  const parsed = assignJobSchema.safeParse({
    vehicleId: formData.get('vehicleId'),
    driverId: formData.get('driverId'),
    scheduledDate: formData.get('scheduledDate'),
    scheduledTime: formData.get('scheduledTime'),
    scheduledWindowEnd: formData.get('scheduledWindowEnd'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const [{ data: existing }, { data: vehicle }, { data: driver }, { data: job }] =
    await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, job_number, status, vehicle_id, driver_id, scheduled_date, scheduled_time, scheduled_window_end',
        )
        .eq('scheduled_date', parsed.data.scheduledDate),
      supabase
        .from('vehicles')
        .select('id, vehicle_code, status, active')
        .eq('id', parsed.data.vehicleId)
        .maybeSingle(),
      supabase
        .from('drivers')
        .select('id, status, availability, active')
        .eq('id', parsed.data.driverId)
        .maybeSingle(),
      supabase.from('jobs').select('status').eq('id', jobId).maybeSingle(),
    ]);

  if (!job) return { error: 'That job could not be found.' };

  const conflicts = findConflicts(
    {
      jobId,
      vehicleId: parsed.data.vehicleId,
      driverId: parsed.data.driverId,
      scheduledDate: parsed.data.scheduledDate,
      scheduledTime: parsed.data.scheduledTime,
      windowEnd: parsed.data.scheduledWindowEnd ?? null,
    },
    {
      existingJobs: ((existing ?? []) as unknown as ScheduledJob[]).map((row) => ({
        ...row,
        windowEnd: (row as unknown as { scheduled_window_end: string | null })
          .scheduled_window_end,
        scheduledDate: (row as unknown as { scheduled_date: string | null })
          .scheduled_date,
        scheduledTime: (row as unknown as { scheduled_time: string | null })
          .scheduled_time,
        jobNumber: (row as unknown as { job_number: string }).job_number,
        vehicleId: (row as unknown as { vehicle_id: string | null }).vehicle_id,
        driverId: (row as unknown as { driver_id: string | null }).driver_id,
      })),
      vehicle: vehicle
        ? {
            id: vehicle.id,
            vehicleCode: vehicle.vehicle_code,
            status: vehicle.status,
            active: vehicle.active,
          }
        : null,
      driver: driver
        ? {
            id: driver.id,
            status: driver.status,
            availability: driver.availability,
            active: driver.active,
          }
        : null,
    },
  );

  if (conflicts.length > 0) {
    return { error: conflicts.map((c) => c.detail).join(' ') };
  }

  // A job must be SCHEDULED before it can be ASSIGNED. Move it there first if
  // it is still merely approved.
  if (job.status === 'APPROVED') {
    const { error: scheduleError } = await supabase
      .from('jobs')
      .update({
        status: 'SCHEDULED',
        scheduled_date: parsed.data.scheduledDate,
        scheduled_time: parsed.data.scheduledTime,
        scheduled_window_end: parsed.data.scheduledWindowEnd,
      })
      .eq('id', jobId);

    if (scheduleError) return { error: scheduleError.message };
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'ASSIGNED',
      vehicle_id: parsed.data.vehicleId,
      driver_id: parsed.data.driverId,
      scheduled_date: parsed.data.scheduledDate,
      scheduled_time: parsed.data.scheduledTime,
      scheduled_window_end: parsed.data.scheduledWindowEnd,
      assigned_by: auth.value.id,
    })
    .eq('id', jobId);

  if (error) return { error: error.message };

  revalidatePath('/dispatch');
  revalidatePath('/command-centre');
  return { success: 'Job assigned.' };
}

/** Unassign a job, returning it to the schedule and freeing the resources. */
export async function unassignJob(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('jobs')
    .update({ status: 'SCHEDULED', vehicle_id: null, driver_id: null })
    .eq('id', jobId);

  if (error) return { error: error.message };

  revalidatePath('/dispatch');
  return { success: 'Job unassigned.' };
}
