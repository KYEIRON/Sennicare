'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { getServerClient } from '@/lib/supabase/server';
import { siteOrganisationSlug } from '@/lib/env';
import { RATE_LIMITS, callerIdentifier, checkRateLimit } from '@/lib/rate-limit';

export interface RequestState {
  readonly error?: string | undefined;
  readonly fieldErrors?: Record<string, string[]> | undefined;
  /** The reference number, once a request has been recorded. */
  readonly reference?: string | undefined;
  /**
   * What was submitted, handed back when a request does not go through, so the
   * form can be refilled rather than wiped.
   */
  readonly values?: Readonly<Record<string, string>> | undefined;
  /** Counts submissions, so the form remounts and re-applies the values. */
  readonly attempt?: number | undefined;
}

/** Every field the form sends. Nothing else is echoed back. */
const FORM_FIELDS = [
  'companyName',
  'contactName',
  'contactEmail',
  'contactPhone',
  'pickupAddress',
  'pickupCity',
  'pickupState',
  'pickupZip',
  'pickupDate',
  'pickupTime',
  'deliveryAddress',
  'deliveryCity',
  'deliveryState',
  'deliveryZip',
  'description',
  'urgency',
  'isRecurring',
  'notes',
] as const;

/**
 * The submitted values, as strings, bounded in length. Only the known fields
 * are copied, so the response can never carry anything the form did not send.
 */
function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of FORM_FIELDS) {
    const value = formData.get(field);
    if (typeof value === 'string' && value.length > 0) {
      values[field] = value.slice(0, 4000);
    }
  }
  return values;
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
  const attempt = (_previous.attempt ?? 0) + 1;
  const failed = (outcome: Omit<RequestState, 'values' | 'attempt'>): RequestState => ({
    ...outcome,
    values: submittedValues(formData),
    attempt,
  });

  // This form is reachable by anybody, and a flood of submissions would bury
  // real requests. The limit is generous enough that a customer who mistypes an
  // address and resubmits is never blocked.
  const limit = checkRateLimit(
    RATE_LIMITS.DELIVERY_REQUEST,
    callerIdentifier(await headers()),
    'delivery-request',
  );

  if (!limit.allowed) {
    return failed({
      error:
        'You have sent several requests in a short time, so this one has not been sent. The earlier ones reached us — if one of them was wrong, tell us when we reply and we will put it right.',
    });
  }

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
    return failed({ fieldErrors: parsed.error.flatten().fieldErrors });
  }

  if (!parsed.data.contactEmail && !parsed.data.contactPhone) {
    return failed({
      error: 'Please leave an email address or a phone number so we can reply.',
    });
  }

  // Not "please call us": BOYD'S publishes no phone number, and this form is the
  // only route to the business. Telling a customer to call a number that
  // exists nowhere on the site would be a dead end presented as help.
  const supabase = await getServerClient();
  const organisation = siteOrganisationSlug();
  if (!supabase || !organisation) {
    return failed({
      error:
        'We could not record your request just now, so nothing has been sent. Please try again in a few minutes — your details are still in the form.',
    });
  }

  const { data, error } = await supabase.rpc('create_public_job_request', {
    p_organisation_slug: organisation,
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
    return failed({
      error:
        'We could not record your request just now, so nothing has been sent. Please try again in a few minutes — your details are still in the form.',
    });
  }

  return { reference: String(data) };
}
