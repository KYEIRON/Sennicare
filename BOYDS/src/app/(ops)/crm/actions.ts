'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { nextLeadNumber } from '@/database/operations';
import { leadSchema } from '@/validation/crm';
import type { FormState } from '@/app/(ops)/customers/actions';

export async function createLead(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = leadSchema.safeParse({
    companyName: formData.get('companyName'),
    contactName: formData.get('contactName'),
    contactEmail: formData.get('contactEmail'),
    contactPhone: formData.get('contactPhone'),
    stage: formData.get('stage'),
    source: formData.get('source'),
    serviceInterest: formData.get('serviceInterest'),
    estimatedValueCents: formData.get('estimatedValue'),
    nextFollowupAt: formData.get('nextFollowupAt'),
    isRecurringOpportunity: formData.get('isRecurring') === 'on',
    recurringDetail: formData.get('recurringDetail'),
    lostReason: formData.get('lostReason'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('leads').insert({
    lead_number: await nextLeadNumber(supabase),
    company_name: parsed.data.companyName,
    contact_name: parsed.data.contactName,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone,
    stage: parsed.data.stage,
    source: parsed.data.source,
    service_interest: parsed.data.serviceInterest,
    estimated_value_cents: parsed.data.estimatedValueCents,
    next_followup_at: parsed.data.nextFollowupAt,
    is_recurring_opportunity: parsed.data.isRecurringOpportunity,
    recurring_detail: parsed.data.recurringDetail,
    lost_reason: parsed.data.lostReason,
    notes: parsed.data.notes,
    owner_user_id: auth.value.id,
    created_by: auth.value.id,
    provenance: 'REAL',
  });

  if (error) return { error: 'Could not save the lead.' };

  revalidatePath('/crm');
  return { success: 'Lead saved.' };
}

/**
 * Move a lead through the pipeline.
 *
 * `LOST` requires a reason, enforced here and by a database constraint.
 */
export async function updateLeadStage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const leadId = String(formData.get('leadId') ?? '');
  const stage = String(formData.get('stage') ?? '');
  const lostReason = formData.get('lostReason')
    ? String(formData.get('lostReason'))
    : null;

  if (stage === 'LOST' && !lostReason?.trim()) {
    return {
      error: 'Say why this lead was lost — the reason is what improves targeting.',
    };
  }

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('leads')
    .update({ stage, lost_reason: stage === 'LOST' ? lostReason : null })
    .eq('id', leadId);

  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { success: 'Lead updated.' };
}
