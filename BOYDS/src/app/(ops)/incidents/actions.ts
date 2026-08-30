'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { incidentReviewSchema } from '@/validation/operations';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * A partner working through an incident.
 *
 * The driver's account is never edited — this records what BOYD'S did about it
 * and, once known, what it cost. A cost left blank stays unknown; it is not
 * zero, and the financial engine will keep saying so.
 */
export async function reviewIncident(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = incidentReviewSchema.safeParse({
    incidentId: formData.get('incidentId'),
    status: formData.get('status'),
    resolutionNotes: formData.get('resolutionNotes'),
    costCents: formData.get('cost'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const update: Record<string, unknown> = {
    status: parsed.data.status,
    resolution_notes: parsed.data.resolutionNotes ?? null,
    reviewed_by: auth.value.id,
    reviewed_at: new Date().toISOString(),
  };

  // Only write the cost when one was given. Sending null on every save would
  // erase a figure a partner established earlier.
  if (parsed.data.costCents !== null && parsed.data.costCents !== undefined) {
    update.cost_cents = parsed.data.costCents;
  }

  const { error } = await supabase
    .from('incidents')
    .update(update)
    .eq('id', parsed.data.incidentId);

  if (error) return { error: 'Could not update the incident.' };

  revalidatePath('/incidents');
  revalidatePath('/command-centre');
  return { success: 'Incident updated.' };
}
