'use server';

import { z } from 'zod';
import { getServerClient } from '@/lib/supabase/server';

export interface RequestState {
  readonly error?: string | undefined;
  readonly fieldErrors?: Record<string, string[]> | undefined;
  /** The reference number, once a request has been recorded. */
  readonly reference?: string | undefined;
}

const requestSchema = z.object({
  companyName: z.string().trim().max(200).optional(),
  contactName: z.string().trim().min(1, 'Please give us your name.').max(200),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .email('Enter a valid email address.')
    .optional()
    .or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional(),

  pickupAddress: z.string().trim().min(1, 'Where should we collect from?').max(300),
  pickupCity: z.string().trim().max(120).optional(),
  pickupState: z.string().trim().max(2).optional(),
  pickupZip: z.string().trim().max(10).optional(),
  pickupDate: z.string().date().optional().or(z.literal('')),
  pickupTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal('')),

  deliveryAddress: z.string().trim().min(1, 'Where should we deliver to?').max(300),
  deliveryCity: z.string().trim().max(120).optional(),
  deliveryState: z.string().trim().max(2).optional(),
  deliveryZip: z.string().trim().max(10).optional(),

  description: z.string().trim().max(2000).optional(),
  urgency: z.enum(['STANDARD', 'SCHEDULED', 'SAME_DAY', 'URGENT', 'CRITICAL']).optional(),
  isRecurring: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Submit a delivery request from the public website.
 *
 * This creates a REQUEST, not a job. BOYD'S does not confirm work here: at the
 * moment a visitor presses this button nobody has checked whether the van is
 * free, what the job would cost, or whether BOYD'S can carry what is being
 * described. Saying "confirmed" would be a promise the system cannot keep.
 *
 * The request is written through a single SECURITY DEFINER function, so the
 * public holds no table grant and can read nothing back.
 */
export async function submitDeliveryRequest(
  _previous: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const parsed = requestSchema.safeParse({
    companyName: formData.get('companyName') ?? undefined,
    contactName: formData.get('contactName'),
    contactEmail: formData.get('contactEmail') ?? undefined,
    contactPhone: formData.get('contactPhone') ?? undefined,
    pickupAddress: formData.get('pickupAddress'),
    pickupCity: formData.get('pickupCity') ?? undefined,
    pickupState: formData.get('pickupState') ?? undefined,
    pickupZip: formData.get('pickupZip') ?? undefined,
    pickupDate: formData.get('pickupDate') ?? undefined,
    pickupTime: formData.get('pickupTime') ?? undefined,
    deliveryAddress: formData.get('deliveryAddress'),
    deliveryCity: formData.get('deliveryCity') ?? undefined,
    deliveryState: formData.get('deliveryState') ?? undefined,
    deliveryZip: formData.get('deliveryZip') ?? undefined,
    description: formData.get('description') ?? undefined,
    urgency: formData.get('urgency') || undefined,
    isRecurring: formData.get('isRecurring') === 'on',
    notes: formData.get('notes') ?? undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!parsed.data.contactEmail && !parsed.data.contactPhone) {
    return { error: 'Please leave an email address or a phone number so we can reply.' };
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return {
      error:
        'We could not record your request just now. Please call us instead — we do not want your request going nowhere.',
    };
  }

  const { data, error } = await supabase.rpc('create_public_job_request', {
    p_company_name: parsed.data.companyName ?? null,
    p_contact_name: parsed.data.contactName,
    p_contact_email: parsed.data.contactEmail || null,
    p_contact_phone: parsed.data.contactPhone || null,
    p_pickup_address: parsed.data.pickupAddress,
    p_pickup_city: parsed.data.pickupCity ?? null,
    p_pickup_state: parsed.data.pickupState ?? null,
    p_pickup_zip: parsed.data.pickupZip ?? null,
    p_delivery_address: parsed.data.deliveryAddress,
    p_delivery_city: parsed.data.deliveryCity ?? null,
    p_delivery_state: parsed.data.deliveryState ?? null,
    p_delivery_zip: parsed.data.deliveryZip ?? null,
    p_description: parsed.data.description ?? null,
    p_pickup_date: parsed.data.pickupDate || null,
    p_pickup_time: parsed.data.pickupTime || null,
    p_urgency: parsed.data.urgency ?? null,
    p_is_recurring: parsed.data.isRecurring,
    p_source: 'WEBSITE',
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    return {
      error:
        'We could not record your request just now. Please call us instead — we do not want your request going nowhere.',
    };
  }

  return { reference: String(data) };
}
