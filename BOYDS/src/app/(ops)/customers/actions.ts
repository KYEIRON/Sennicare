'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { nextCustomerNumber } from '@/database/operations';
import {
  customerContactSchema,
  customerLocationSchema,
  customerSchema,
} from '@/validation/operations';
import { z } from 'zod';

export interface FormState {
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
  success?: string | undefined;
}

/**
 * Create a customer.
 *
 * Guarded server-side. Row level security enforces the same boundary again at
 * the database, so a mistake here cannot let a driver create a customer.
 */
export async function createCustomer(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = customerSchema.safeParse({
    companyName: formData.get('companyName'),
    customerType: formData.get('customerType'),
    customerStatus: formData.get('customerStatus'),
    industryId: formData.get('industryId') || null,
    paymentTermsDays: formData.get('paymentTermsDays'),
    leadSource: formData.get('leadSource'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('customers').insert({
    customer_number: await nextCustomerNumber(supabase),
    company_name: parsed.data.companyName,
    customer_type: parsed.data.customerType,
    customer_status: parsed.data.customerStatus,
    industry_id: parsed.data.industryId ?? null,
    // Left NULL when blank: BOYD'S payment terms are NOT CONFIGURED and this
    // does not invent one.
    payment_terms_days: parsed.data.paymentTermsDays,
    lead_source: parsed.data.leadSource,
    notes: parsed.data.notes,
    created_by: auth.value.id,
    provenance: 'REAL',
  });

  if (error) return { error: 'Could not save the customer.' };

  revalidatePath('/customers');
  return { success: 'Customer saved.' };
}

/**
 * A note on the customer's record.
 *
 * The history the master instruction asks for is built from these: what was
 * agreed on the phone, why a job ran late, what they said about the price.
 * Notes are additions to the record, never edits to it.
 */
const noteSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1, 'Write the note.').max(4000),
  isPinned: z.boolean().default(false),
});

export async function addCustomerNote(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = noteSchema.safeParse({
    customerId: formData.get('customerId'),
    body: formData.get('body'),
    isPinned: formData.get('isPinned') === 'on',
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('customer_notes').insert({
    customer_id: parsed.data.customerId,
    body: parsed.data.body,
    is_pinned: parsed.data.isPinned,
    created_by: auth.value.id,
  });

  if (error) return { error: 'Could not save the note.' };

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: 'Note saved.' };
}

/** Another person at the customer. At most one is primary — the database says so. */
export async function addCustomerContact(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const customerId = String(formData.get('customerId') ?? '');
  if (!z.string().uuid().safeParse(customerId).success) {
    return { error: 'That customer could not be found.' };
  }

  const parsed = customerContactSchema.safeParse({
    name: formData.get('name'),
    role: formData.get('role') || 'PRIMARY',
    jobTitle: formData.get('jobTitle'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    isPrimary: formData.get('isPrimary') === 'on',
    notes: formData.get('notes'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('customer_contacts').insert({
    customer_id: customerId,
    name: parsed.data.name,
    role: parsed.data.role,
    job_title: parsed.data.jobTitle ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    is_primary: parsed.data.isPrimary,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    // A unique index allows only one primary contact per customer. Say what
    // actually went wrong rather than "could not save".
    return {
      error: parsed.data.isPrimary
        ? 'This customer already has a main contact. Change that one first.'
        : 'Could not save the contact.',
    };
  }

  revalidatePath(`/customers/${customerId}`);
  return { success: 'Contact saved.' };
}

/**
 * A reusable address.
 *
 * Recording a customer's regular collection and delivery points once is what
 * makes repeat-route analysis possible later.
 */
export async function addCustomerLocation(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const customerId = String(formData.get('customerId') ?? '');
  if (!z.string().uuid().safeParse(customerId).success) {
    return { error: 'That customer could not be found.' };
  }

  const parsed = customerLocationSchema.safeParse({
    kind: formData.get('kind') || 'SERVICE',
    label: formData.get('label'),
    addressLine1: formData.get('addressLine1'),
    addressLine2: formData.get('addressLine2'),
    city: formData.get('city'),
    state: formData.get('state'),
    zip: formData.get('zip'),
    contactName: formData.get('contactName'),
    contactPhone: formData.get('contactPhone'),
    instructions: formData.get('instructions'),
    isDefault: formData.get('isDefault') === 'on',
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('customer_locations').insert({
    customer_id: customerId,
    kind: parsed.data.kind,
    label: parsed.data.label ?? null,
    address_line1: parsed.data.addressLine1,
    address_line2: parsed.data.addressLine2 ?? null,
    city: parsed.data.city,
    state: parsed.data.state,
    zip: parsed.data.zip,
    contact_name: parsed.data.contactName ?? null,
    contact_phone: parsed.data.contactPhone ?? null,
    instructions: parsed.data.instructions ?? null,
    is_default: parsed.data.isDefault,
  });

  if (error) return { error: 'Could not save the address.' };

  revalidatePath(`/customers/${customerId}`);
  return { success: 'Address saved.' };
}
