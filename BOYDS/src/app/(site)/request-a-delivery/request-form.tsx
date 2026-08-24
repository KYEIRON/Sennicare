'use client';

import { useActionState } from 'react';
import { submitDeliveryRequest, type RequestState } from './actions';

const CONTROL =
  'w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2.5 text-boyd-light-100 placeholder:text-boyd-light-600 focus:border-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-500/40 focus:outline-none';

function Field({
  label,
  name,
  children,
  errors,
  required,
}: Readonly<{
  label: string;
  name: string;
  children: React.ReactNode;
  errors?: Record<string, string[]> | undefined;
  required?: boolean;
}>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-boyd-light-300">
        {label}
        {required && <span className="ml-1 text-boyd-orange-500">*</span>}
      </label>
      {children}
      {errors?.[name]?.map((message) => (
        <p key={message} className="mt-1 text-sm text-boyd-negative">
          {message}
        </p>
      ))}
    </div>
  );
}

export function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(
    submitDeliveryRequest,
    {},
  );

  if (state.reference) {
    return (
      <div
        role="status"
        className="rounded-lg border border-boyd-positive/40 bg-boyd-positive/10 p-6"
      >
        <h2 className="text-xl font-semibold text-boyd-light-50">
          Your request has been received
        </h2>
        <p className="mt-3 text-boyd-light-300">
          Your reference is{' '}
          <span className="figure font-semibold text-boyd-light-50">
            {state.reference}
          </span>
          .
        </p>
        <p className="mt-3 text-sm text-boyd-light-400">
          It will be reviewed by the BOYD&rsquo;S team and we will come back to you with
          what we can do and what it costs. This is not a confirmed booking yet.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold tracking-wider text-boyd-orange-400 uppercase">
          You
        </legend>

        <Field label="Your name" name="contactName" errors={state.fieldErrors} required>
          <input
            id="contactName"
            name="contactName"
            required
            maxLength={200}
            className={CONTROL}
          />
        </Field>

        <Field label="Company" name="companyName" errors={state.fieldErrors}>
          <input
            id="companyName"
            name="companyName"
            maxLength={200}
            className={CONTROL}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email" name="contactEmail" errors={state.fieldErrors}>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              maxLength={254}
              className={CONTROL}
            />
          </Field>
          <Field label="Phone" name="contactPhone" errors={state.fieldErrors}>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              maxLength={40}
              className={CONTROL}
            />
          </Field>
        </div>
        <p className="text-xs text-boyd-light-500">
          One of these is enough — whichever you prefer we use.
        </p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold tracking-wider text-boyd-orange-400 uppercase">
          Collection
        </legend>

        <Field label="Address" name="pickupAddress" errors={state.fieldErrors} required>
          <input
            id="pickupAddress"
            name="pickupAddress"
            required
            maxLength={300}
            className={CONTROL}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="City" name="pickupCity" errors={state.fieldErrors}>
            <input
              id="pickupCity"
              name="pickupCity"
              maxLength={120}
              className={CONTROL}
            />
          </Field>
          <Field label="State" name="pickupState" errors={state.fieldErrors}>
            <input
              id="pickupState"
              name="pickupState"
              maxLength={2}
              placeholder="NC"
              className={CONTROL}
            />
          </Field>
          <Field label="ZIP" name="pickupZip" errors={state.fieldErrors}>
            <input id="pickupZip" name="pickupZip" maxLength={10} className={CONTROL} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date needed" name="pickupDate" errors={state.fieldErrors}>
            <input id="pickupDate" name="pickupDate" type="date" className={CONTROL} />
          </Field>
          <Field label="Time" name="pickupTime" errors={state.fieldErrors}>
            <input id="pickupTime" name="pickupTime" type="time" className={CONTROL} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold tracking-wider text-boyd-blue-300 uppercase">
          Delivery
        </legend>

        <Field label="Address" name="deliveryAddress" errors={state.fieldErrors} required>
          <input
            id="deliveryAddress"
            name="deliveryAddress"
            required
            maxLength={300}
            className={CONTROL}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="City" name="deliveryCity" errors={state.fieldErrors}>
            <input
              id="deliveryCity"
              name="deliveryCity"
              maxLength={120}
              className={CONTROL}
            />
          </Field>
          <Field label="State" name="deliveryState" errors={state.fieldErrors}>
            <input
              id="deliveryState"
              name="deliveryState"
              maxLength={2}
              placeholder="NC"
              className={CONTROL}
            />
          </Field>
          <Field label="ZIP" name="deliveryZip" errors={state.fieldErrors}>
            <input
              id="deliveryZip"
              name="deliveryZip"
              maxLength={10}
              className={CONTROL}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold tracking-wider text-boyd-light-400 uppercase">
          What needs moving
        </legend>

        <Field label="Describe it" name="description" errors={state.fieldErrors}>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="Size, weight, how many pieces, anything we should handle carefully"
            className={CONTROL}
          />
        </Field>

        <Field label="How urgent is it?" name="urgency" errors={state.fieldErrors}>
          <select id="urgency" name="urgency" defaultValue="" className={CONTROL}>
            <option value="">Not sure</option>
            <option value="CRITICAL">Critical — as fast as possible</option>
            <option value="URGENT">Urgent — today</option>
            <option value="SAME_DAY">Same day</option>
            <option value="SCHEDULED">A specific day and time</option>
            <option value="STANDARD">No particular rush</option>
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-boyd-light-300">
          <input type="checkbox" name="isRecurring" className="h-4 w-4" />
          This is something we need regularly
        </label>

        <Field label="Anything else" name="notes" errors={state.fieldErrors}>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            maxLength={2000}
            className={CONTROL}
          />
        </Field>
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded border border-boyd-negative/40 bg-boyd-negative/10 p-3 text-sm text-boyd-negative"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-boyd-orange-600 px-6 py-3.5 font-semibold text-white hover:bg-boyd-orange-500 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send request'}
      </button>

      <p className="text-center text-xs text-boyd-light-500">
        We will come back to you with what we can do and what it costs. Nothing is
        confirmed until we have agreed it with you.
      </p>
    </form>
  );
}
