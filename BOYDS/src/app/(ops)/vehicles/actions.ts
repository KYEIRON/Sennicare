'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { vehicleSchema, vehicleStatusChangeSchema } from '@/validation/operations';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Add a vehicle.
 *
 * Every specification field is optional. A blank stays NULL and reads as
 * NOT CONFIGURED — BOYD'S fills these in from real documents, and an unknown
 * purchase price is not a free van.
 */
export async function createVehicle(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = vehicleSchema.safeParse({
    vehicleCode: formData.get('vehicleCode'),
    licensePlate: formData.get('licensePlate'),
    licenseState: formData.get('licenseState'),
    vin: formData.get('vin'),
    make: formData.get('make'),
    model: formData.get('model'),
    year: formData.get('year'),
    vehicleType: formData.get('vehicleType') || null,
    purchaseDate: formData.get('purchaseDate'),
    purchasePriceCents: formData.get('purchasePrice'),
    currentOdometerTenths: formData.get('currentOdometer'),
    insuranceProvider: formData.get('insuranceProvider'),
    insurancePolicyNumber: formData.get('insurancePolicyNumber'),
    insuranceRenewalDate: formData.get('insuranceRenewalDate'),
    insuranceCostCents: formData.get('insuranceCost'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('vehicles').insert({
    vehicle_code: parsed.data.vehicleCode,
    license_plate: parsed.data.licensePlate,
    license_state: parsed.data.licenseState,
    vin: parsed.data.vin,
    make: parsed.data.make,
    model: parsed.data.model,
    year: parsed.data.year,
    vehicle_type: parsed.data.vehicleType,
    purchase_date: parsed.data.purchaseDate,
    purchase_price_cents: parsed.data.purchasePriceCents,
    current_odometer_tenths: parsed.data.currentOdometerTenths,
    insurance_provider: parsed.data.insuranceProvider,
    insurance_policy_number: parsed.data.insurancePolicyNumber,
    insurance_renewal_date: parsed.data.insuranceRenewalDate,
    insurance_cost_cents: parsed.data.insuranceCostCents,
    notes: parsed.data.notes,
    provenance: 'REAL',
  });

  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'That vehicle code is already in use.'
          : 'Could not save the vehicle.',
    };
  }

  revalidatePath('/vehicles');
  return { success: 'Vehicle saved.' };
}

/**
 * Change a vehicle's status.
 *
 * ASSIGNED and IN_TRANSIT are rejected: those follow job activity. A van is not
 * in transit because someone picked it from a menu.
 */
export async function changeVehicleStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const vehicleId = String(formData.get('vehicleId') ?? '');
  const parsed = vehicleStatusChangeSchema.safeParse({
    status: formData.get('status'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('vehicles')
    .update({ status: parsed.data.status })
    .eq('id', vehicleId);

  if (error) return { error: 'Could not change the vehicle status.' };

  revalidatePath('/vehicles');
  return { success: 'Vehicle status updated.' };
}
