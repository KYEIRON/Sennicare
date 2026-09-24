'use client';

import { useActionState, useState } from 'react';
import { createInvoice } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { Field, Select, SubmitButton, TextInput } from '@/components/ui/form';
import { formatCents } from '@/lib/format';
import { cents } from '@/types/branded';

export function InvoiceForm({
  customers,
  uninvoicedJobs,
}: Readonly<{
  customers: readonly { id: string; companyName: string }[];
  uninvoicedJobs: readonly {
    id: string;
    jobNumber: string;
    customerId: string;
    wonPriceCents: number;
  }[];
}>) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInvoice, {});
  const [customerId, setCustomerId] = useState('');

  const jobsForCustomer = uninvoicedJobs.filter((job) => job.customerId === customerId);

  return (
    <form action={action} className="space-y-3">
      <p className="rounded border border-boyd-navy-700 bg-boyd-navy-950 p-3 text-xs text-boyd-light-400">
        Only completed jobs with an agreed price can be invoiced. An invoice becomes paid
        when a payment is recorded against it — there is no way to mark it paid by hand.
      </p>

      <Field label="Customer" name="customerId" errors={state.fieldErrors}>
        <Select
          name="customerId"
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        >
          <option value="" disabled>
            Choose a customer
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.companyName}
            </option>
          ))}
        </Select>
      </Field>

      {customerId && (
        <fieldset className="rounded border border-boyd-navy-700 p-3">
          <legend className="px-1 text-xs font-semibold tracking-wider text-boyd-light-400 uppercase">
            Jobs to bill
          </legend>

          {jobsForCustomer.length === 0 ? (
            <p className="text-sm text-boyd-light-500">
              No completed, priced jobs are waiting to be invoiced for this customer.
            </p>
          ) : (
            <ul className="space-y-2">
              {jobsForCustomer.map((job) => (
                <li key={job.id}>
                  <label className="flex items-center justify-between gap-3 text-sm text-boyd-light-200">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="jobIds"
                        value={job.id}
                        defaultChecked
                        className="h-4 w-4"
                      />
                      <span className="figure">{job.jobNumber}</span>
                    </span>
                    <span className="figure text-boyd-light-300">
                      {formatCents(cents(job.wonPriceCents))}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      <Field
        label="Payment terms (days)"
        name="dueDays"
        errors={state.fieldErrors}
        hint="BOYD'S standard terms are not configured, so enter the terms agreed with this customer."
      >
        <TextInput name="dueDays" inputMode="numeric" required defaultValue="30" />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-boyd-negative">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-boyd-positive">
          {state.success}
        </p>
      )}

      <SubmitButton pending={pending}>Create invoice</SubmitButton>
    </form>
  );
}
