'use client';

import { useActionState, useState } from 'react';
import { convertRequestToJob, declineRequest, markUnderReview } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

/**
 * What a partner can do with an incoming request.
 *
 * Three deliberate acts, never an automatic one: take it on, decline it with a
 * reason worth keeping, or say you are looking at it so the other partner does
 * not duplicate the call.
 *
 * Converting does not price the job. The enquiry carried no agreed price, so
 * the job is created without one and the quote is a separate, conscious step.
 */
export interface RequestAddresses {
  readonly pickupAddress: string | null;
  readonly pickupCity: string | null;
  readonly pickupState: string | null;
  readonly pickupZip: string | null;
  readonly deliveryAddress: string | null;
  readonly deliveryCity: string | null;
  readonly deliveryState: string | null;
  readonly deliveryZip: string | null;
}

export function RequestActions({
  requestId,
  jobTypes,
  customers,
  addresses,
}: Readonly<{
  requestId: string;
  jobTypes: readonly { id: string; name: string }[];
  customers: readonly { id: string; companyName: string; customerNumber: string }[];
  addresses: RequestAddresses;
}>) {
  const [open, setOpen] = useState<'convert' | 'decline' | null>(null);

  return (
    <div className="mt-3 border-t border-boyd-navy-700 pt-3">
      <div className="flex flex-wrap gap-2">
        <SecondaryButton
          onClick={() => setOpen(open === 'convert' ? null : 'convert')}
          active={open === 'convert'}
        >
          Turn into a job
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setOpen(open === 'decline' ? null : 'decline')}
          active={open === 'decline'}
        >
          Decline
        </SecondaryButton>
        <UnderReviewButton requestId={requestId} />
      </div>

      {open === 'convert' && (
        <ConvertForm
          requestId={requestId}
          jobTypes={jobTypes}
          customers={customers}
          addresses={addresses}
        />
      )}
      {open === 'decline' && <DeclineForm requestId={requestId} />}
    </div>
  );
}

function SecondaryButton({
  onClick,
  active,
  children,
}: Readonly<{ onClick: () => void; active: boolean; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-boyd-blue-400 focus:outline-none ${
        active
          ? 'border-boyd-blue-500 bg-boyd-blue-600/20 text-boyd-light-100'
          : 'border-boyd-navy-700 text-boyd-light-300 hover:border-boyd-blue-500 hover:text-boyd-light-100'
      }`}
    >
      {children}
    </button>
  );
}

function UnderReviewButton({ requestId }: Readonly<{ requestId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    markUnderReview,
    {},
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-boyd-navy-700 px-3 py-1.5 text-sm font-medium text-boyd-light-300 transition-colors hover:border-boyd-blue-500 hover:text-boyd-light-100 focus:ring-2 focus:ring-boyd-blue-400 focus:outline-none disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'I am looking at this'}
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-boyd-negative">
          {state.error}
        </span>
      )}
      {state.success && (
        <span role="status" className="text-xs text-boyd-positive">
          {state.success}
        </span>
      )}
    </form>
  );
}

function ConvertForm({
  requestId,
  jobTypes,
  customers,
  addresses,
}: Readonly<{
  requestId: string;
  jobTypes: readonly { id: string; name: string }[];
  customers: readonly { id: string; companyName: string; customerNumber: string }[];
  addresses: RequestAddresses;
}>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    convertRequestToJob,
    {},
  );

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="requestId" value={requestId} />

      <p className="rounded border border-boyd-navy-700 bg-boyd-navy-950 p-3 text-xs text-boyd-light-400">
        The job is created as <span className="font-semibold">approved</span> — agreed to,
        but not yet scheduled and <span className="font-semibold">not priced</span>. The
        collection and delivery details come straight from the enquiry; check them, quote
        the customer, then schedule the van.
      </p>

      <Field label="What kind of job is it?" name="jobTypeId" errors={state.fieldErrors}>
        <Select name="jobTypeId" required defaultValue="">
          <option value="" disabled>
            Choose
          </option>
          {jobTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Customer"
        name="customerId"
        errors={state.fieldErrors}
        hint="Leave blank to create a new customer from the enquiry details."
      >
        <Select name="customerId" defaultValue="">
          <option value="">Create a new customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.companyName} ({customer.customerNumber})
            </option>
          ))}
        </Select>
      </Field>

      <AddressBlock
        legend="Collection"
        prefix="pickup"
        address={addresses.pickupAddress}
        city={addresses.pickupCity}
        stateCode={addresses.pickupState}
        zip={addresses.pickupZip}
        errors={state.fieldErrors}
      />

      <AddressBlock
        legend="Delivery"
        prefix="delivery"
        address={addresses.deliveryAddress}
        city={addresses.deliveryCity}
        stateCode={addresses.deliveryState}
        zip={addresses.deliveryZip}
        errors={state.fieldErrors}
      />

      <Field label="Priority" name="priority" errors={state.fieldErrors}>
        <Select name="priority" defaultValue="STANDARD">
          <option value="STANDARD">Standard</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="SAME_DAY">Same day</option>
          <option value="URGENT">Urgent</option>
          <option value="CRITICAL">Critical</option>
        </Select>
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-boyd-negative">
          {state.error}
        </p>
      )}

      <SubmitButton pending={pending}>Create the job</SubmitButton>
    </form>
  );
}

function DeclineForm({ requestId }: Readonly<{ requestId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    declineRequest,
    {},
  );

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="requestId" value={requestId} />

      <Field
        label="Why is BOYD’S declining?"
        name="reason"
        errors={state.fieldErrors}
        hint="Kept on the record. Over time this is what shows which work BOYD’S keeps turning away."
      >
        <TextArea name="reason" rows={3} required maxLength={500} />
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

      <SubmitButton pending={pending}>Decline the request</SubmitButton>
    </form>
  );
}

/**
 * One end of the journey.
 *
 * Prefilled from the enquiry where the customer gave it, blank where they did
 * not. Nothing is defaulted — a guessed state or a stand-in ZIP would put an
 * address on the job that nobody confirmed, and the van would be driven to it.
 */
function AddressBlock({
  legend,
  prefix,
  address,
  city,
  stateCode,
  zip,
  errors,
}: Readonly<{
  legend: string;
  prefix: 'pickup' | 'delivery';
  address: string | null;
  city: string | null;
  stateCode: string | null;
  zip: string | null;
  errors: Record<string, string[]> | undefined;
}>) {
  const incomplete = !address || !city || !stateCode || !zip;

  return (
    <fieldset className="space-y-3 rounded border border-boyd-navy-700 p-3">
      <legend className="px-1 text-sm font-semibold text-boyd-light-200">{legend}</legend>

      {incomplete && (
        <p className="text-xs text-boyd-warning">
          The enquiry did not give a complete address. Confirm it with the customer and
          enter it — nothing here is filled in for you.
        </p>
      )}

      <Field label="Street address" name={`${prefix}Address`} errors={errors}>
        <TextInput
          name={`${prefix}Address`}
          required
          maxLength={200}
          defaultValue={address ?? ''}
        />
      </Field>

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <Field label="City" name={`${prefix}City`} errors={errors}>
            <TextInput
              name={`${prefix}City`}
              required
              maxLength={120}
              defaultValue={city ?? ''}
            />
          </Field>
        </div>
        <Field label="State" name={`${prefix}State`} errors={errors}>
          <TextInput
            name={`${prefix}State`}
            required
            maxLength={2}
            placeholder="NC"
            defaultValue={stateCode ?? ''}
          />
        </Field>
        <Field label="ZIP" name={`${prefix}Zip`} errors={errors}>
          <TextInput
            name={`${prefix}Zip`}
            required
            inputMode="numeric"
            maxLength={10}
            defaultValue={zip ?? ''}
          />
        </Field>
      </div>
    </fieldset>
  );
}
