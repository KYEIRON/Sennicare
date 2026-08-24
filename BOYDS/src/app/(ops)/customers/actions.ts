'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { nextCustomerNumber } from '@/database/operations';
import { customerSchema } from '@/validation/operations';

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
