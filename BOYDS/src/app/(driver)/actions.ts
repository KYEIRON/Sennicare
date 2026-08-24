'use server';

import { revalidatePath } from 'next/cache';
import { requireDriver } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { validateTransition } from '@/services/jobs/state-machine';
import type { JobStatus } from '@/types/operations';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * A driver advances their own job.
 *
 * Guarded three ways: this action requires a driver, row level security limits
 * the update to jobs assigned to them, and the column trigger stops them
 * touching pricing, assignment or internal notes.
 */
export async function advanceDriverJob(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireDriver();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');
  const toStatus = String(formData.get('toStatus') ?? '') as JobStatus;

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  // Read through driver_jobs so this path never touches a financial column.
  const { data: job } = await supabase
    .from('driver_jobs')
    .select('status, driver_id, actual_miles_tenths')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) return { error: 'That job could not be found.' };

  const check = validateTransition(job.status as JobStatus, toStatus, {
    driverId: job.driver_id,
    actualMilesTenths: job.actual_miles_tenths,
  });

  if (!check.ok) return { error: check.error.message };

  const { error } = await supabase
    .from('jobs')
    .update({ status: toStatus })
    .eq('id', jobId);
  if (error) return { error: error.message };

  revalidatePath('/driver/today');
  revalidatePath(`/driver/jobs/${jobId}`);
  return { success: 'Updated.' };
}

/** A driver records mileage from the odometer, splitting loaded from empty. */
export async function recordDriverMileage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireDriver();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');

  const start = Number(formData.get('startOdometer'));
  const end = Number(formData.get('endOdometer'));
  const emptyMiles = formData.get('emptyMiles') ? Number(formData.get('emptyMiles')) : 0;

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { error: 'Enter both odometer readings.' };
  }
  if (end < start) {
    return { error: 'The end reading cannot be lower than the start reading.' };
  }
  if (!Number.isFinite(emptyMiles) || emptyMiles < 0) {
    return { error: 'Empty miles must be zero or more.' };
  }

  const totalTenths = Math.round((end - start) * 10);
  const emptyTenths = Math.round(emptyMiles * 10);

  if (emptyTenths > totalTenths) {
    return { error: 'Empty miles cannot exceed the total miles driven.' };
  }

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('jobs')
    .update({
      start_odometer_tenths: Math.round(start * 10),
      end_odometer_tenths: Math.round(end * 10),
      actual_miles_tenths: totalTenths,
      loaded_miles_tenths: totalTenths - emptyTenths,
      empty_miles_tenths: emptyTenths,
    })
    .eq('id', jobId);

  if (error) return { error: error.message };

  revalidatePath(`/driver/jobs/${jobId}`);
  return { success: 'Mileage recorded.' };
}
