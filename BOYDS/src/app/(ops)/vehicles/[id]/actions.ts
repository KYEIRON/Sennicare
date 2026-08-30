'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { VEHICLE_COST_LINES } from '@/types/economics';
import type { FormState } from '@/app/(ops)/customers/actions';

/** A required dollar amount, as typed, converted to integer cents. */
const usdCents = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const cleaned = (typeof value === 'number' ? value.toFixed(2) : value.trim()).replace(
    /[$,\s]/g,
    '',
  );

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid dollar amount.' });
    return 0;
  }

  const [whole = '0', fraction = ''] = cleaned.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (cents <= 0) {
    ctx.addIssue({ code: 'custom', message: 'The amount must be more than zero.' });
  }
  return cents;
});

const costEntrySchema = z.object({
  costLine: z.enum(VEHICLE_COST_LINES),
  period: z.enum(['MONTHLY', 'ANNUAL', 'PER_MILE', 'ONE_OFF']),
  amountCents: usdCents,
  includedInCostPerMile: z.boolean().default(true),
  effectiveFrom: z.string().date('Enter the date this cost starts.'),
  effectiveTo: z
    .string()
    .date()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
});

/**
 * Record a real cost BOYD'S pays for a vehicle.
 *
 * These are what true cost per mile is derived from. Nothing here is assumed:
 * an entry exists because a real amount is paid or contracted, so the derived
 * rate is a measurement rather than an estimate.
 */
export async function addVehicleCost(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const vehicleId = String(formData.get('vehicleId') ?? '');

  const parsed = costEntrySchema.safeParse({
    costLine: formData.get('costLine'),
    period: formData.get('period'),
    amountCents: formData.get('amount'),
    includedInCostPerMile: formData.get('includedInCostPerMile') !== 'off',
    effectiveFrom: formData.get('effectiveFrom'),
    effectiveTo: formData.get('effectiveTo'),
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('vehicle_cost_entries').insert({
    vehicle_id: vehicleId,
    cost_line: parsed.data.costLine,
    period: parsed.data.period,
    amount_cents: parsed.data.amountCents,
    included_in_cost_per_mile: parsed.data.includedInCostPerMile,
    effective_from: parsed.data.effectiveFrom,
    effective_to: parsed.data.effectiveTo,
    notes: parsed.data.notes,
    created_by: auth.value.id,
  });

  if (error) return { error: 'Could not save the cost.' };

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath('/reports');
  return { success: 'Cost recorded.' };
}

/** Include or exclude a cost line from true cost per mile. */
export async function toggleCostInclusion(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const entryId = String(formData.get('entryId') ?? '');
  const vehicleId = String(formData.get('vehicleId') ?? '');
  const include = formData.get('include') === 'true';

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('vehicle_cost_entries')
    .update({ included_in_cost_per_mile: include })
    .eq('id', entryId);

  if (error) return { error: 'Could not update the cost.' };

  revalidatePath(`/vehicles/${vehicleId}`);
  return {
    success: include ? 'Included in cost per mile.' : 'Excluded from cost per mile.',
  };
}

const maintenanceSchema = z
  .object({
    maintenanceType: z.enum([
      'SERVICE',
      'OIL',
      'TYRES',
      'REPAIR',
      'INSPECTION',
      'REGISTRATION',
      'INSURANCE',
      'OTHER',
    ]),
    description: z
      .string()
      .trim()
      .max(500)
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
    dueDate: z
      .string()
      .date()
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    dueMiles: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((value) => {
        if (value === null || value === undefined || value === '') return null;
        const parsed = typeof value === 'number' ? value : Number(String(value).trim());
        return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) : null;
      }),
    completedDate: z
      .string()
      .date()
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    costCents: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((value, ctx) => {
        // Blank means the work has not been priced yet — NOT that it was free.
        if (value === null || value === undefined || value === '') return null;

        const cleaned = (
          typeof value === 'number' ? value.toFixed(2) : value.trim()
        ).replace(/[$,\s]/g, '');
        if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
          ctx.addIssue({ code: 'custom', message: 'Enter a valid dollar amount.' });
          return null;
        }
        const [whole = '0', fraction = ''] = cleaned.split('.');
        return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      }),
    vendor: z
      .string()
      .trim()
      .max(200)
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
  })
  // A record with no due date, no due mileage and no completion date is not a
  // reminder — it is a note nobody will ever see again.
  .refine(
    (record) =>
      record.dueDate !== null ||
      record.dueMiles !== null ||
      record.completedDate !== null,
    {
      message: 'Say when it is due, or that it is already done.',
      path: ['dueDate'],
    },
  );

/** Schedule or record vehicle maintenance. */
export async function recordMaintenance(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const vehicleId = String(formData.get('vehicleId') ?? '');

  const parsed = maintenanceSchema.safeParse({
    maintenanceType: formData.get('maintenanceType'),
    description: formData.get('description') ?? '',
    dueDate: formData.get('dueDate'),
    dueMiles: formData.get('dueMiles'),
    completedDate: formData.get('completedDate'),
    costCents: formData.get('cost'),
    vendor: formData.get('vendor') ?? '',
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('maintenance_records').insert({
    vehicle_id: vehicleId,
    maintenance_type: parsed.data.maintenanceType,
    description: parsed.data.description,
    due_date: parsed.data.dueDate,
    due_odometer_tenths: parsed.data.dueMiles,
    completed_date: parsed.data.completedDate,
    cost_cents: parsed.data.costCents,
    vendor: parsed.data.vendor,
    created_by: auth.value.id,
  });

  if (error) return { error: 'Could not save the maintenance record.' };

  revalidatePath(`/vehicles/${vehicleId}`);
  return {
    success:
      parsed.data.completedDate && parsed.data.costCents
        ? 'Recorded. This cost now counts towards the van’s cost per mile.'
        : 'Maintenance recorded.',
  };
}
