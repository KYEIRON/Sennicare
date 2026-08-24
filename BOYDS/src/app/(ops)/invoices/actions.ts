'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { nextInvoiceNumber } from '@/database/operations';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Raise an invoice from completed jobs.
 *
 * Only jobs that are COMPLETED with an agreed price can be invoiced: billing
 * for work that is not finished, or at a price nobody agreed, is how a customer
 * relationship goes wrong.
 */
export async function createInvoice(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const customerId = String(formData.get('customerId') ?? '');
  const jobIds = formData.getAll('jobIds').map(String).filter(Boolean);
  const dueDays = Number(formData.get('dueDays') ?? 0);

  if (!customerId) return { error: 'Choose a customer.' };
  if (jobIds.length === 0) return { error: 'Choose at least one job to invoice.' };
  if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 180) {
    return { error: 'Enter the payment terms in days.' };
  }

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, won_price_cents, status, customer_id')
    .in('id', jobIds);

  const billable = (jobs ?? []).filter(
    (job) =>
      job.status === 'COMPLETED' &&
      job.won_price_cents !== null &&
      job.customer_id === customerId,
  );

  if (billable.length !== jobIds.length) {
    return {
      error:
        'Only completed jobs with an agreed price, belonging to this customer, can be invoiced.',
    };
  }

  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + dueDays);

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: await nextInvoiceNumber(supabase),
      customer_id: customerId,
      status: 'DRAFT',
      issue_date: issueDate.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      created_by: auth.value.id,
      provenance: 'REAL',
    })
    .select('id, invoice_number')
    .single();

  if (error || !invoice) return { error: 'Could not create the invoice.' };

  const { error: linesError } = await supabase.from('invoice_lines').insert(
    billable.map((job, index) => ({
      invoice_id: invoice.id,
      job_id: job.id,
      sequence: index + 1,
      description: `Job ${job.job_number}`,
      quantity: 1,
      unit_price_cents: job.won_price_cents,
      total_cents: job.won_price_cents,
    })),
  );

  if (linesError) {
    // An invoice with no lines bills nothing; remove it rather than leaving it.
    await supabase.from('invoices').delete().eq('id', invoice.id);
    return { error: 'Could not add the invoice lines.' };
  }

  revalidatePath('/invoices');
  return { success: `Invoice ${invoice.invoice_number} created.` };
}

/**
 * Record a payment.
 *
 * This is the ONLY way an invoice becomes paid. The status follows from the
 * payment rows by database trigger, so "paid" always means money received.
 */
export async function recordPayment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const invoiceId = String(formData.get('invoiceId') ?? '');
  const raw = String(formData.get('amount') ?? '').replace(/[$,\s]/g, '');
  const method = String(formData.get('method') ?? 'BANK_TRANSFER');
  const reference = formData.get('reference') ? String(formData.get('reference')) : null;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { error: 'Enter the amount received.' };
  }

  const [whole = '0', fraction = ''] = raw.split('.');
  const amountCents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (amountCents <= 0) return { error: 'A payment must be more than zero.' };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('payments').insert({
    invoice_id: invoiceId,
    amount_cents: amountCents,
    method,
    reference,
    received_at: new Date().toISOString().slice(0, 10),
    recorded_by: auth.value.id,
  });

  if (error) return { error: 'Could not record the payment.' };

  revalidatePath('/invoices');
  return { success: 'Payment recorded.' };
}

/** Send an invoice. */
export async function sendInvoice(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const invoiceId = String(formData.get('invoiceId') ?? '');

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'SENT' })
    .eq('id', invoiceId);

  if (error) return { error: error.message };

  revalidatePath('/invoices');

  // BOYD'S has no email provider connected, so the invoice is marked sent for
  // BOYD'S records and the partner sends it themselves. Nothing here claims an
  // email went out.
  return {
    success:
      'Marked as sent. No email provider is connected, so send the invoice to the customer yourself.',
  };
}
