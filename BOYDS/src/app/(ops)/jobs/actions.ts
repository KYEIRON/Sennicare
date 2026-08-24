'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { nextJobNumber } from '@/database/operations';
import {
  createJobSchema,
  jobCostsSchema,
  jobMileageSchema,
} from '@/validation/operations';
import { validateTransition } from '@/services/jobs/state-machine';
import type { JobStatus } from '@/types/operations';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Create a job.
 *
 * Validation happens before anything is written, so a half-finished job never
 * reaches the schedule looking like work BOYD'S has committed to. A job needs a
 * customer, a type, and at least one pickup and one delivery, with every pickup
 * before the first delivery.
 */
export async function createJob(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const stops = [
    {
      sequence: 1,
      stopType: 'PICKUP' as const,
      addressLine1: formData.get('pickupAddress'),
      city: formData.get('pickupCity'),
      state: formData.get('pickupState'),
      zip: formData.get('pickupZip'),
      contactName: formData.get('pickupContact'),
      contactPhone: formData.get('pickupPhone'),
      instructions: formData.get('pickupInstructions'),
      scheduledDate: formData.get('scheduledDate') || null,
      scheduledTime: formData.get('pickupTime'),
    },
    {
      sequence: 2,
      stopType: 'DELIVERY' as const,
      addressLine1: formData.get('deliveryAddress'),
      city: formData.get('deliveryCity'),
      state: formData.get('deliveryState'),
      zip: formData.get('deliveryZip'),
      contactName: formData.get('deliveryContact'),
      contactPhone: formData.get('deliveryPhone'),
      instructions: formData.get('deliveryInstructions'),
      scheduledDate:
        formData.get('deliveryDate') || formData.get('scheduledDate') || null,
      scheduledTime: formData.get('deliveryTime'),
    },
  ];

  const parsed = createJobSchema.safeParse({
    customerId: formData.get('customerId'),
    jobTypeId: formData.get('jobTypeId'),
    priority: formData.get('priority'),
    description: formData.get('description'),
    quantity: formData.get('quantity') ? Number(formData.get('quantity')) : null,
    weightLbs: formData.get('weightLbs') ? Number(formData.get('weightLbs')) : null,
    dimensions: formData.get('dimensions'),
    pallets: formData.get('pallets') ? Number(formData.get('pallets')) : null,
    specialHandling: formData.get('specialHandling'),
    scheduledDate: formData.get('scheduledDate') || null,
    scheduledTime: formData.get('pickupTime'),
    scheduledWindowEnd: formData.get('windowEnd'),
    estimatedMilesTenths: formData.get('estimatedMiles'),
    quotedPriceCents: formData.get('quotedPrice'),
    notes: formData.get('notes'),
    stops,
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      fieldErrors: flattened.fieldErrors as Record<string, string[]>,
      error: flattened.formErrors[0],
    };
  }

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const jobNumber = await nextJobNumber(supabase);

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      job_number: jobNumber,
      customer_id: parsed.data.customerId,
      job_type_id: parsed.data.jobTypeId,
      priority: parsed.data.priority,
      status: 'REQUESTED',
      source: 'PARTNER',
      description: parsed.data.description,
      quantity: parsed.data.quantity,
      weight_lbs: parsed.data.weightLbs,
      dimensions: parsed.data.dimensions,
      pallets: parsed.data.pallets,
      special_handling: parsed.data.specialHandling,
      scheduled_date: parsed.data.scheduledDate,
      scheduled_time: parsed.data.scheduledTime,
      scheduled_window_end: parsed.data.scheduledWindowEnd,
      estimated_miles_tenths: parsed.data.estimatedMilesTenths,
      quoted_price_cents: parsed.data.quotedPriceCents,
      notes: parsed.data.notes,
      created_by: auth.value.id,
      provenance: 'REAL',
    })
    .select('id')
    .single();

  if (error || !job) return { error: 'Could not save the job.' };

  const { error: stopsError } = await supabase.from('job_stops').insert(
    parsed.data.stops.map((stop) => ({
      job_id: job.id,
      sequence: stop.sequence,
      stop_type: stop.stopType,
      address_line1: stop.addressLine1,
      city: stop.city,
      state: stop.state,
      zip: stop.zip,
      contact_name: stop.contactName,
      contact_phone: stop.contactPhone,
      instructions: stop.instructions,
      scheduled_date: stop.scheduledDate,
      scheduled_time: stop.scheduledTime,
    })),
  );

  if (stopsError) {
    // The job cannot stand without its stops, so remove it rather than leaving
    // a job with nowhere to collect from or deliver to.
    await supabase.from('jobs').delete().eq('id', job.id);
    return { error: 'Could not save the collection and delivery details.' };
  }

  revalidatePath('/jobs');
  return { success: `Job ${jobNumber} created.` };
}

/**
 * Advance a job's status.
 *
 * Validated here for a clear message, and again by the database trigger, which
 * is what actually holds. Both use the same transition table.
 */
export async function advanceJobStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');
  const toStatus = String(formData.get('toStatus') ?? '') as JobStatus;
  const reason = formData.get('reason') ? String(formData.get('reason')) : null;

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { data: job } = await supabase
    .from('jobs')
    .select('status, vehicle_id, driver_id, actual_miles_tenths')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) return { error: 'That job could not be found.' };

  const check = validateTransition(job.status as JobStatus, toStatus, {
    vehicleId: job.vehicle_id,
    driverId: job.driver_id,
    actualMilesTenths: job.actual_miles_tenths,
    cancellationReason: reason,
  });

  if (!check.ok) return { error: check.error.message };

  const update: Record<string, unknown> = { status: toStatus };
  if (toStatus === 'CANCELLED') update.cancellation_reason = reason;

  const { error } = await supabase.from('jobs').update(update).eq('id', jobId);
  if (error) return { error: error.message };

  revalidatePath('/jobs');
  revalidatePath('/dispatch');
  revalidatePath('/command-centre');
  return { success: `Job moved to ${toStatus.replace(/_/g, ' ').toLowerCase()}.` };
}

/** Record actual costs. Blank fields stay MISSING — never zero. */
export async function recordJobCosts(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');
  const parsed = jobCostsSchema.safeParse({
    fuelCostActualCents: formData.get('fuelCost'),
    driverCostActualCents: formData.get('driverCost'),
    vehicleCostActualCents: formData.get('vehicleCost'),
    tollCostActualCents: formData.get('tollCost'),
    parkingCostActualCents: formData.get('parkingCost'),
    otherCostActualCents: formData.get('otherCost'),
    wonPriceCents: formData.get('wonPrice'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  // Only write fields that were actually filled in. Writing null over an
  // existing recorded cost would silently erase it.
  const update: Record<string, number> = {};
  const mapping = {
    fuel_cost_actual_cents: parsed.data.fuelCostActualCents,
    driver_cost_actual_cents: parsed.data.driverCostActualCents,
    vehicle_cost_actual_cents: parsed.data.vehicleCostActualCents,
    toll_cost_actual_cents: parsed.data.tollCostActualCents,
    parking_cost_actual_cents: parsed.data.parkingCostActualCents,
    other_cost_actual_cents: parsed.data.otherCostActualCents,
    won_price_cents: parsed.data.wonPriceCents,
  };

  for (const [column, value] of Object.entries(mapping)) {
    if (value !== null) update[column] = value;
  }

  if (Object.keys(update).length === 0) return { error: 'Nothing to record.' };

  const { error } = await supabase.from('jobs').update(update).eq('id', jobId);
  if (error) return { error: 'Could not record the costs.' };

  revalidatePath('/jobs');
  revalidatePath('/command-centre');
  return { success: 'Costs recorded.' };
}

/** Record mileage. Loaded plus empty must account for the total. */
export async function recordJobMileage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const jobId = String(formData.get('jobId') ?? '');
  const parsed = jobMileageSchema.safeParse({
    actualMilesTenths: formData.get('actualMiles'),
    loadedMilesTenths: formData.get('loadedMiles'),
    emptyMilesTenths: formData.get('emptyMiles'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('jobs')
    .update({
      actual_miles_tenths: parsed.data.actualMilesTenths,
      loaded_miles_tenths: parsed.data.loadedMilesTenths,
      empty_miles_tenths: parsed.data.emptyMilesTenths,
    })
    .eq('id', jobId);

  if (error) return { error: 'Could not record the mileage.' };

  revalidatePath('/jobs');
  revalidatePath('/command-centre');
  return { success: 'Mileage recorded.' };
}
