'use client';

import { useActionState } from 'react';
import {
  addCustomerContact,
  addCustomerLocation,
  addCustomerNote,
  type FormState,
} from '../actions';
import { Field, Select, SubmitButton, TextArea, TextInput } from '@/components/ui/form';

/** A note on the record. Additions only — nothing here edits history. */
export function NoteForm({ customerId }: Readonly<{ customerId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addCustomerNote,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />

      <Field label="What happened?" name="body" errors={state.fieldErrors}>
        <TextArea
          name="body"
          rows={3}
          required
          maxLength={4000}
          placeholder="What was agreed, what they asked for, what went wrong"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-boyd-light-300">
        <input type="checkbox" name="isPinned" className="h-4 w-4" />
        Keep this at the top
      </label>

      <Status state={state} />
      <SubmitButton pending={pending}>Save note</SubmitButton>
    </form>
  );
}

export function ContactForm({ customerId }: Readonly<{ customerId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addCustomerContact,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />

      <Field label="Name" name="name" errors={state.fieldErrors}>
        <TextInput name="name" required maxLength={200} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Role" name="role" errors={state.fieldErrors}>
          <Select name="role" defaultValue="PRIMARY">
            <option value="PRIMARY">Main contact</option>
            <option value="BILLING">Billing</option>
            <option value="OPERATIONS">Operations</option>
            <option value="SITE">On site</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Job title" name="jobTitle" errors={state.fieldErrors}>
          <TextInput name="jobTitle" maxLength={150} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" name="email" errors={state.fieldErrors}>
          <TextInput name="email" type="email" />
        </Field>
        <Field label="Phone" name="phone" errors={state.fieldErrors}>
          <TextInput name="phone" type="tel" maxLength={40} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-boyd-light-300">
        <input type="checkbox" name="isPrimary" className="h-4 w-4" />
        This is the main contact
      </label>

      <Status state={state} />
      <SubmitButton pending={pending}>Save contact</SubmitButton>
    </form>
  );
}

export function LocationForm({ customerId }: Readonly<{ customerId: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addCustomerLocation,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="What is it?" name="kind" errors={state.fieldErrors}>
          <Select name="kind" defaultValue="SERVICE">
            <option value="SERVICE">General address</option>
            <option value="PICKUP">Collection point</option>
            <option value="DELIVERY">Delivery point</option>
            <option value="BILLING">Billing address</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Label" name="label" errors={state.fieldErrors}>
          <TextInput name="label" maxLength={150} placeholder="Warehouse, Loading dock" />
        </Field>
      </div>

      <Field label="Street address" name="addressLine1" errors={state.fieldErrors}>
        <TextInput name="addressLine1" required maxLength={200} />
      </Field>
      <Field label="Line 2" name="addressLine2" errors={state.fieldErrors}>
        <TextInput name="addressLine2" maxLength={200} />
      </Field>

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <Field label="City" name="city" errors={state.fieldErrors}>
            <TextInput name="city" required maxLength={120} />
          </Field>
        </div>
        <Field label="State" name="state" errors={state.fieldErrors}>
          <TextInput name="state" required maxLength={2} placeholder="NC" />
        </Field>
        <Field label="ZIP" name="zip" errors={state.fieldErrors}>
          <TextInput name="zip" required inputMode="numeric" maxLength={10} />
        </Field>
      </div>

      <Field label="Instructions" name="instructions" errors={state.fieldErrors}>
        <TextArea name="instructions" rows={2} maxLength={2000} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-boyd-light-300">
        <input type="checkbox" name="isDefault" className="h-4 w-4" />
        Use this address by default
      </label>

      <Status state={state} />
      <SubmitButton pending={pending}>Save address</SubmitButton>
    </form>
  );
}

function Status({ state }: Readonly<{ state: FormState }>) {
  return (
    <>
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
    </>
  );
}
