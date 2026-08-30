'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { nextCustomerNumber, nextJobNumber } from '@/database/operations';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Turning a request into work.
 *
 * A request is an enquiry. Converting it is a deliberate act by a partner who
 * has decided BOYD'S can and will do the job — which is why nothing here
 * happens automatically, and why the conversion creates the job at APPROVED
 * rather than further along.
 */

const usState = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use a two-letter state code, such as NC.');

const usZip = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, 'Use a 5-digit ZIP code, optionally ZIP+4.');

const conversionSchema = z.object({
  requestId: z.string().uuid(),
  jobTypeId: z.string().uuid('Choose a job type.'),
  /** An existing customer, or blank to create one from the request. */
  customerId: z.string().uuid().nullable().optional(),
  priority: z.enum(['STANDARD', 'SCHEDULED', 'SAME_DAY', 'URGENT', 'CRITICAL']),

  // An enquiry often arrives without a complete address — someone phones and
  // says "Charlotte to Concord". The partner supplies the rest here. Nothing
  // is defaulted: a guessed state or a placeholder ZIP would send the van to
  // an address nobody confirmed.
  pickupAddress: z.string().trim().min(1, 'Enter the collection address.').max(200),
  pickupCity: z.string().trim().min(1, 'Enter the collection city.').max(120),
  pickupState: usState,
  pickupZip: usZip,
  deliveryAddress: z.string().trim().min(1, 'Enter the delivery address.').max(200),
  deliveryCity: z.string().trim().min(1, 'Enter the delivery city.').max(120),
  deliveryState: usState,
  deliveryZip: usZip,
});

export async function convertRequestToJob(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = conversionSchema.safeParse({
    requestId: formData.get('requestId'),
    jobTypeId: formData.get('jobTypeId'),
    customerId: formData.get('customerId') || null,
    priority: formData.get('priority') || 'STANDARD',
    pickupAddress: formData.get('pickupAddress'),
    pickupCity: formData.get('pickupCity'),
    pickupState: formData.get('pickupState'),
    pickupZip: formData.get('pickupZip'),
    deliveryAddress: formData.get('deliveryAddress'),
    deliveryCity: formData.get('deliveryCity'),
    deliveryState: formData.get('deliveryState'),
    deliveryZip: formData.get('deliveryZip'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { data: request } = await supabase
    .from('job_requests')
    .select('*')
    .eq('id', parsed.data.requestId)
    .maybeSingle();

  if (!request) return { error: 'That request could not be found.' };
  if (request.status === 'CONVERTED') {
    return { error: 'That request has already been turned into a job.' };
  }

  // Use the customer chosen, or create one from what the enquirer told us.
  // Nothing is invented: only fields the request actually carries are copied.
  let customerId = parsed.data.customerId ?? request.customer_id;

  if (!customerId) {
    // The customer record has to be named after someone real. If the enquiry
    // carries neither a company nor a contact, there is nothing to name it
    // after and BOYD'S will not invent one.
    const name = request.company_name ?? request.contact_name;
    if (!name) {
      return {
        error:
          'This enquiry has no company or contact name, so a customer cannot be created from it. Choose an existing customer, or add the name to the enquiry first.',
      };
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        customer_number: await nextCustomerNumber(supabase),
        company_name: name,
        customer_type: request.company_name ? 'BUSINESS' : 'INDIVIDUAL',
        customer_status: 'ACTIVE',
        primary_contact_name: request.contact_name,
        primary_contact_email: request.contact_email,
        primary_contact_phone: request.contact_phone,
        lead_source: request.source,
        created_by: auth.value.id,
        provenance: 'REAL',
      })
      .select('id')
      .single();

    if (customerError || !customer) return { error: 'Could not create the customer.' };
    customerId = customer.id;
  }

  const jobNumber = await nextJobNumber(supabase);

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      job_number: jobNumber,
      customer_id: customerId,
      job_type_id: parsed.data.jobTypeId,
      // APPROVED, not SCHEDULED: a partner has agreed to do it, but nobody has
      // yet checked the van is free on that day.
      status: 'APPROVED',
      priority: parsed.data.priority,
      source: request.source,
      description: request.description,
      special_handling: request.special_handling,
      weight_lbs: request.weight_lbs,
      quantity: request.quantity,
      pallets: request.pallets,
      scheduled_date: request.pickup_date,
      scheduled_time: request.pickup_time,
      is_after_hours: request.is_after_hours,
      // Deliberately no price. The request carried none, and inventing one here
      // would put a figure on a job nobody quoted.
      notes: request.notes,
      created_by: auth.value.id,
      provenance: 'REAL',
    })
    .select('id')
    .single();

  if (jobError || !job) return { error: 'Could not create the job.' };

  const { error: stopsError } = await supabase.from('job_stops').insert([
    {
      job_id: job.id,
      sequence: 1,
      stop_type: 'PICKUP',
      address_line1: parsed.data.pickupAddress,
      city: parsed.data.pickupCity,
      state: parsed.data.pickupState,
      zip: parsed.data.pickupZip,
      contact_name: request.contact_name,
      contact_phone: request.contact_phone,
      scheduled_date: request.pickup_date,
      scheduled_time: request.pickup_time,
    },
    {
      job_id: job.id,
      sequence: 2,
      stop_type: 'DELIVERY',
      address_line1: parsed.data.deliveryAddress,
      city: parsed.data.deliveryCity,
      state: parsed.data.deliveryState,
      zip: parsed.data.deliveryZip,
      contact_name: request.contact_name,
      contact_phone: request.contact_phone,
      scheduled_date: request.delivery_date ?? request.pickup_date,
      scheduled_time: request.delivery_time,
    },
  ]);

  if (stopsError) {
    await supabase.from('jobs').delete().eq('id', job.id);
    return { error: 'Could not copy the collection and delivery details.' };
  }

  await supabase
    .from('job_requests')
    .update({
      status: 'CONVERTED',
      converted_job_id: job.id,
      customer_id: customerId,
      reviewed_by: auth.value.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.requestId);

  revalidatePath('/requests');
  revalidatePath('/jobs');
  redirect(`/jobs/${job.id}`);
}

/** Decline a request. A reason is required — it is what tells BOYD'S why. */
export async function declineRequest(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const requestId = String(formData.get('requestId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (reason.length === 0) {
    return { error: 'Say why BOYD’S is declining — the reason is worth keeping.' };
  }

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('job_requests')
    .update({
      status: 'DECLINED',
      declined_reason: reason,
      reviewed_by: auth.value.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) return { error: 'Could not decline the request.' };

  revalidatePath('/requests');
  return { success: 'Request declined.' };
}

/** Mark a request as being looked at, so the other partner knows. */
export async function markUnderReview(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const requestId = String(formData.get('requestId') ?? '');

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('job_requests')
    .update({
      status: 'UNDER_REVIEW',
      reviewed_by: auth.value.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) return { error: 'Could not update the request.' };

  revalidatePath('/requests');
  return { success: 'Marked as under review.' };
}
