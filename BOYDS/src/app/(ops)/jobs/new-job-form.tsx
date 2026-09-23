'use client';

import { useActionState, useState } from 'react';
import { createJob } from './actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import { JOB_PRIORITIES, type StopType } from '@/types/operations';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

/**
 * The New Job workflow.
 *
 * Everything needed for a real job is validated before anything is saved, so an
 * incomplete job never appears on the schedule as though BOYD'S had agreed to
 * do it. A job starts at REQUESTED and is moved forward deliberately.
 *
 * A job is as many stops as the work actually has. Two is the common case and
 * is what the form opens with, but a multi-drop run is entered as a multi-drop
 * run rather than being split into jobs that never happened.
 */
export function NewJobForm({
  customers,
  jobTypes,
}: Readonly<{
  customers: readonly { id: string; companyName: string }[];
  jobTypes: readonly { id: string; name: string }[];
}>) {
  const [state, action, pending] = useActionState<FormState, FormData>(createJob, {});

  // Two to begin with, because most BOYD'S work is one collection and one
  // delivery. Neither is fixed — a multi-drop run adds rows.
  const [stops, setStops] = useState<readonly StopRow[]>([
    { key: 'stop-1', stopType: 'PICKUP' },
    { key: 'stop-2', stopType: 'DELIVERY' },
  ]);

  const addStop = () =>
    setStops((current) => [
      ...current,
      { key: `stop-${Date.now()}`, stopType: 'DELIVERY' },
    ]);

  const removeStop = (index: number) =>
    setStops((current) => current.filter((_, position) => position !== index));

  const setStopType = (index: number, stopType: StopType) =>
    setStops((current) =>
      current.map((stop, position) =>
        position === index ? { ...stop, stopType } : stop,
      ),
    );

  if (customers.length === 0) {
    return (
      <p className="text-sm text-boyd-light-400">
        Add a customer first — a job cannot exist without one.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label="Customer" name="customerId" errors={state.fieldErrors}>
        <Select name="customerId" required defaultValue="">
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Job type" name="jobTypeId" errors={state.fieldErrors}>
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
        <Field label="Priority" name="priority" errors={state.fieldErrors}>
          <Select name="priority" defaultValue="STANDARD">
            {JOB_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <input type="hidden" name="stopCount" value={stops.length} />

      <div className="space-y-3">
        {stops.map((stop, index) => (
          <StopFieldset
            key={stop.key}
            index={index}
            stopType={stop.stopType}
            position={index + 1}
            total={stops.length}
            errors={state.fieldErrors}
            onTypeChange={(value) => setStopType(index, value)}
            onRemove={stops.length > 2 ? () => removeStop(index) : undefined}
          />
        ))}

        <button
          type="button"
          onClick={addStop}
          className="w-full rounded-md border border-dashed border-boyd-navy-600 px-4 py-2.5 text-sm font-medium text-boyd-light-300 hover:border-boyd-blue-500 hover:text-boyd-light-100"
        >
          Add another stop
        </button>

        {state.fieldErrors?.stops?.map((message) => (
          <p key={message} role="alert" className="text-sm text-boyd-negative">
            {message}
          </p>
        ))}
      </div>

      <fieldset className="space-y-3 rounded border border-boyd-navy-700 p-3">
        <legend className="px-1 text-xs font-semibold tracking-wider text-boyd-light-400 uppercase">
          Schedule and shipment
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Date"
            name="scheduledDate"
            errors={state.fieldErrors}
            hint="Applies to every stop unless one says otherwise."
          >
            <TextInput name="scheduledDate" type="date" />
          </Field>
          <Field
            label="Back by"
            name="windowEnd"
            errors={state.fieldErrors}
            hint="The end of the window the customer agreed to."
          >
            <TextInput name="windowEnd" type="time" />
          </Field>
        </div>
        <Field label="Description" name="description" errors={state.fieldErrors}>
          <TextArea name="description" rows={2} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Pieces" name="quantity" errors={state.fieldErrors}>
            <TextInput name="quantity" inputMode="numeric" />
          </Field>
          <Field label="Weight (lbs)" name="weightLbs" errors={state.fieldErrors}>
            <TextInput name="weightLbs" inputMode="decimal" />
          </Field>
          <Field label="Pallets" name="pallets" errors={state.fieldErrors}>
            <TextInput name="pallets" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Special handling" name="specialHandling" errors={state.fieldErrors}>
          <TextInput name="specialHandling" maxLength={1000} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Estimated miles"
            name="estimatedMiles"
            errors={state.fieldErrors}
            hint="An estimate. It never becomes the actual."
          >
            <TextInput name="estimatedMiles" inputMode="decimal" />
          </Field>
          <Field label="Quoted price" name="quotedPrice" errors={state.fieldErrors}>
            <TextInput name="quotedPrice" inputMode="decimal" placeholder="$" />
          </Field>
        </div>
      </fieldset>

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

      <SubmitButton pending={pending}>Create job</SubmitButton>
    </form>
  );
}

interface StopRow {
  readonly key: string;
  readonly stopType: StopType;
}

const STOP_TYPE_LABELS: Readonly<Record<StopType, string>> = {
  PICKUP: 'Collect',
  DELIVERY: 'Deliver',
  INTERMEDIATE: 'Call at',
};

const STOP_ACCENTS: Readonly<Record<StopType, string>> = {
  PICKUP: 'text-boyd-orange-400',
  DELIVERY: 'text-boyd-blue-300',
  INTERMEDIATE: 'text-boyd-light-400',
};

/**
 * One stop on the run.
 *
 * The order on screen is the order of the run, and the server takes the
 * sequence from that order rather than from anything the browser sends.
 */
function StopFieldset({
  index,
  stopType,
  position,
  total,
  errors,
  onTypeChange,
  onRemove,
}: Readonly<{
  index: number;
  stopType: StopType;
  position: number;
  total: number;
  errors: Record<string, string[]> | undefined;
  onTypeChange: (value: StopType) => void;
  onRemove?: (() => void) | undefined;
}>) {
  const field = (name: string) => `stops[${index}].${name}`;

  return (
    <fieldset className="space-y-3 rounded border border-boyd-navy-700 p-3">
      <legend
        className={`px-1 text-xs font-semibold tracking-wider uppercase ${STOP_ACCENTS[stopType]}`}
      >
        Stop {position} of {total}
      </legend>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <Field label="What happens here?" name={field('stopType')} errors={errors}>
            <Select
              name={field('stopType')}
              value={stopType}
              onChange={(event) => onTypeChange(event.target.value as StopType)}
            >
              <option value="PICKUP">{STOP_TYPE_LABELS.PICKUP}</option>
              <option value="DELIVERY">{STOP_TYPE_LABELS.DELIVERY}</option>
              <option value="INTERMEDIATE">{STOP_TYPE_LABELS.INTERMEDIATE}</option>
            </Select>
          </Field>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-boyd-navy-700 px-3 py-2 text-sm text-boyd-light-400 hover:border-boyd-negative hover:text-boyd-negative"
          >
            Remove
          </button>
        )}
      </div>

      <Field label="Address" name={field('addressLine1')} errors={errors}>
        <TextInput name={field('addressLine1')} required maxLength={200} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="City" name={field('city')} errors={errors}>
          <TextInput name={field('city')} required maxLength={120} />
        </Field>
        <Field label="State" name={field('state')} errors={errors}>
          <TextInput name={field('state')} required maxLength={2} placeholder="NC" />
        </Field>
        <Field label="ZIP" name={field('zip')} errors={errors}>
          <TextInput name={field('zip')} required maxLength={10} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Contact" name={field('contactName')} errors={errors}>
          <TextInput name={field('contactName')} maxLength={200} />
        </Field>
        <Field label="Phone" name={field('contactPhone')} errors={errors}>
          <TextInput name={field('contactPhone')} type="tel" maxLength={40} />
        </Field>
        <Field label="Time" name={field('scheduledTime')} errors={errors}>
          <TextInput name={field('scheduledTime')} type="time" />
        </Field>
      </div>

      <Field label="Instructions" name={field('instructions')} errors={errors}>
        <TextArea name={field('instructions')} rows={2} />
      </Field>
    </fieldset>
  );
}
