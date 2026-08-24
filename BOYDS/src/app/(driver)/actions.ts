'use server';

import { revalidatePath } from 'next/cache';
import { requireDriver } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { validateTransition } from '@/services/jobs/state-machine';
import type { JobStatus } from '@/types/operations';
import type { FormState } from '@/app/(ops)/customers/actions';
import { getStorage, documentPath } from '@/integrations/storage';
import {
  decodeSignature,
  expenseSchema,
  fuelSchema,
  signatureSchema,
  uploadSchema,
} from '@/validation/field-records';

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

/**
 * Capture a signature at the delivery.
 *
 * Stored as a real image in the private documents bucket, linked to the job,
 * with the signer's name as they gave it and a timestamp. Nothing about the
 * signer is inferred.
 */
export async function captureSignature(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireDriver();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = signatureSchema.safeParse({
    jobId: formData.get('jobId'),
    signedByName: formData.get('signedByName'),
    imageData: formData.get('imageData'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const image = decodeSignature(parsed.data.imageData);
  if (!image) return { error: 'The signature could not be read. Please try again.' };

  const storage = await getStorage();
  if (!storage.available) {
    return { error: 'File storage is not connected, so the signature was not saved.' };
  }

  const path = documentPath('jobs', parsed.data.jobId, 'signature.png');
  const stored = await storage.upload({
    path,
    body: new Blob([new Uint8Array(image)], { type: 'image/png' }),
    contentType: 'image/png',
  });

  if (!stored.ok) return { error: stored.error.message };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('documents').insert({
    document_type: 'SIGNATURE',
    entity_table: 'jobs',
    entity_id: parsed.data.jobId,
    storage_path: stored.value.path,
    file_name: 'signature.png',
    mime_type: 'image/png',
    size_bytes: stored.value.sizeBytes,
    signed_by_name: parsed.data.signedByName,
    uploaded_by: auth.value.id,
  });

  if (error) {
    // The file is orphaned if the record failed, so remove it rather than
    // leaving a signature nothing points at.
    await storage.remove(stored.value.path);
    return { error: 'Could not save the signature.' };
  }

  revalidatePath(`/driver/jobs/${parsed.data.jobId}`);
  return { success: 'Signature captured.' };
}

/** Upload a photo or a receipt from the phone camera. */
export async function uploadJobPhoto(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireDriver();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');
  const documentType = String(formData.get('documentType') ?? 'DELIVERY_PHOTO');
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose or take a photo first.' };
  }

  const parsed = uploadSchema.safeParse({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That file cannot be uploaded.' };
  }

  const storage = await getStorage();
  if (!storage.available) {
    return { error: 'File storage is not connected, so the photo was not saved.' };
  }

  const path = documentPath('jobs', jobId, parsed.data.fileName);
  const stored = await storage.upload({
    path,
    body: await file.arrayBuffer(),
    contentType: parsed.data.mimeType,
  });

  if (!stored.ok) return { error: stored.error.message };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('documents').insert({
    document_type: documentType,
    entity_table: 'jobs',
    entity_id: jobId,
    storage_path: stored.value.path,
    file_name: parsed.data.fileName,
    mime_type: parsed.data.mimeType,
    size_bytes: stored.value.sizeBytes,
    caption: formData.get('caption') ? String(formData.get('caption')) : null,
    uploaded_by: auth.value.id,
  });

  if (error) {
    await storage.remove(stored.value.path);
    return { error: 'Could not save the photo.' };
  }

  revalidatePath(`/driver/jobs/${jobId}`);
  return { success: 'Photo saved.' };
}

/**
 * Record an expense in the field.
 *
 * The expense rolls up into the job's actual cost by database trigger, so
 * recording a receipt immediately makes that job's contribution more complete.
 */
export async function recordExpense(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireDriver();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = expenseSchema.safeParse({
    jobId: formData.get('jobId') || null,
    category: formData.get('category'),
    amountCents: formData.get('amount'),
    description: formData.get('description') || undefined,
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const driver = await currentDriverRecord(supabase, auth.value.id);
  if (!driver) return { error: 'No driver record is linked to this account.' };

  const { error } = await supabase.from('job_expenses').insert({
    job_id: parsed.data.jobId,
    vehicle_id: driver.current_vehicle_id,
    driver_id: driver.id,
    category: parsed.data.category,
    amount_cents: parsed.data.amountCents,
    description: parsed.data.description ?? null,
    recorded_by: auth.value.id,
  });

  if (error) return { error: 'Could not record the expense.' };

  revalidatePath('/driver/today');
  if (parsed.data.jobId) revalidatePath(`/driver/jobs/${parsed.data.jobId}`);
  return { success: 'Expense recorded.' };
}

/** Record a fuel purchase. Creates the matching expense automatically. */
export async function recordFuel(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requireDriver();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const driver = await currentDriverRecord(supabase, auth.value.id);
  if (!driver) return { error: 'No driver record is linked to this account.' };
  if (!driver.current_vehicle_id) {
    return {
      error: 'No vehicle is assigned to you, so fuel cannot be recorded against one.',
    };
  }

  const parsed = fuelSchema.safeParse({
    jobId: formData.get('jobId') || null,
    vehicleId: driver.current_vehicle_id,
    gallonsThousandths: formData.get('gallons'),
    pricePerGallonCents: formData.get('pricePerGallon'),
    totalCostCents: formData.get('total'),
    odometerTenths: formData.get('odometer'),
    station: formData.get('station') || undefined,
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const { error } = await supabase.from('fuel_transactions').insert({
    vehicle_id: parsed.data.vehicleId,
    driver_id: driver.id,
    job_id: parsed.data.jobId,
    gallons_thousandths: parsed.data.gallonsThousandths,
    price_per_gallon_cents: parsed.data.pricePerGallonCents,
    total_cost_cents: parsed.data.totalCostCents,
    odometer_tenths: parsed.data.odometerTenths,
    station: parsed.data.station ?? null,
    recorded_by: auth.value.id,
  });

  if (error) return { error: 'Could not record the fuel purchase.' };

  revalidatePath('/driver/today');
  return { success: 'Fuel recorded.' };
}

/** The signed-in driver's own record. */
async function currentDriverRecord(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  userId: string,
): Promise<{ id: string; current_vehicle_id: string | null } | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('drivers')
    .select('id, current_vehicle_id')
    .eq('user_id', userId)
    .maybeSingle();

  return data ?? null;
}
