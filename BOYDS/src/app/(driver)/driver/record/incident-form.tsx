'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { reportIncident } from '../../actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPES,
} from '@/types/operations';

const CONTROL =
  'w-full rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100';

/**
 * Reporting what happened, from the roadside.
 *
 * Large targets, plain words, and no field that asks Moh to estimate anything.
 * The three yes/no questions have no pre-selected answer on purpose: an
 * untouched "no" next to "was anyone hurt" is a claim nobody made.
 */
export function IncidentForm({
  jobs,
}: Readonly<{ jobs: readonly { id: string; job_number: string }[] }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    reportIncident,
    {},
  );
  const [police, setPolice] = useState<string | null>(null);
  const [thirdParty, setThirdParty] = useState<string | null>(null);

  // Prefilled with now, in the driver's own device time, and editable — an
  // incident is often reported once things have calmed down.
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="incidentType" className="mb-1 block text-sm text-boyd-light-300">
          What happened?
        </label>
        <select
          id="incidentType"
          name="incidentType"
          required
          defaultValue=""
          className={CONTROL}
        >
          <option value="" disabled>
            Choose
          </option>
          {INCIDENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {INCIDENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <FieldError errors={state.fieldErrors} name="incidentType" />
      </div>

      <div>
        <label htmlFor="severity" className="mb-1 block text-sm text-boyd-light-300">
          How serious is it?
        </label>
        <select
          id="severity"
          name="severity"
          required
          defaultValue=""
          className={CONTROL}
        >
          <option value="" disabled>
            Choose
          </option>
          {INCIDENT_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {INCIDENT_SEVERITY_LABELS[severity]}
            </option>
          ))}
        </select>
        <FieldError errors={state.fieldErrors} name="severity" />
      </div>

      <div>
        <label htmlFor="occurredAt" className="mb-1 block text-sm text-boyd-light-300">
          When?
        </label>
        <input
          id="occurredAt"
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={localNow}
          className={CONTROL}
        />
        <FieldError errors={state.fieldErrors} name="occurredAt" />
      </div>

      <div>
        <label
          htmlFor="locationDescription"
          className="mb-1 block text-sm text-boyd-light-300"
        >
          Where?
        </label>
        <input
          id="locationDescription"
          name="locationDescription"
          maxLength={300}
          placeholder="A road, a junction, a customer's yard"
          className={CONTROL}
        />
        <p className="mt-1 text-xs text-boyd-light-500">
          Type it. The van has no tracker, so nothing is filled in for you.
        </p>
      </div>

      <div>
        <label htmlFor="jobId" className="mb-1 block text-sm text-boyd-light-300">
          Which job? (leave blank if it was between jobs)
        </label>
        <select id="jobId" name="jobId" defaultValue="" className={CONTROL}>
          <option value="">Not on a job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.job_number}
            </option>
          ))}
        </select>
      </div>

      <YesNo
        name="anyoneInjured"
        question="Was anyone hurt?"
        errors={state.fieldErrors}
      />
      <YesNo
        name="policeInvolved"
        question="Were the police involved?"
        errors={state.fieldErrors}
        onChange={setPolice}
      />
      {police === 'yes' && (
        <div>
          <label
            htmlFor="policeReportNumber"
            className="mb-1 block text-sm text-boyd-light-300"
          >
            Police report number, if they gave one
          </label>
          <input
            id="policeReportNumber"
            name="policeReportNumber"
            maxLength={100}
            className={CONTROL}
          />
          <FieldError errors={state.fieldErrors} name="policeReportNumber" />
        </div>
      )}

      <YesNo
        name="thirdPartyInvolved"
        question="Was anyone else involved?"
        errors={state.fieldErrors}
        onChange={setThirdParty}
      />
      {thirdParty === 'yes' && (
        <div>
          <label
            htmlFor="thirdPartyDetails"
            className="mb-1 block text-sm text-boyd-light-300"
          >
            Who, and what they told you
          </label>
          <textarea
            id="thirdPartyDetails"
            name="thirdPartyDetails"
            rows={3}
            maxLength={2000}
            className={CONTROL}
          />
          <FieldError errors={state.fieldErrors} name="thirdPartyDetails" />
        </div>
      )}

      <YesNo
        name="goodsAffected"
        question="Was the load affected?"
        errors={state.fieldErrors}
      />

      <div>
        <label htmlFor="description" className="mb-1 block text-sm text-boyd-light-300">
          What happened, in your own words
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          maxLength={4000}
          className={CONTROL}
        />
        <FieldError errors={state.fieldErrors} name="description" />
      </div>

      <p className="rounded-lg border border-boyd-warning/30 bg-boyd-warning/5 p-3 text-sm text-boyd-light-300">
        Once you send this you cannot change it, and the partners are told straight away.
        That is on purpose — a report that can be rewritten later is no use to anyone.
      </p>

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

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-boyd-negative px-4 py-4 text-base font-bold text-white active:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Report it'}
      </button>
    </form>
  );
}

function FieldError({
  errors,
  name,
}: Readonly<{ errors: Record<string, string[]> | undefined; name: string }>) {
  const message = errors?.[name]?.[0];
  if (!message) return null;
  return <p className="mt-1 text-sm text-boyd-negative">{message}</p>;
}

/**
 * A question with no default answer.
 *
 * Radios rather than a checkbox: an unticked box says "no" without anyone
 * having said it, and these are the answers an insurer asks about.
 */
function YesNo({
  name,
  question,
  errors,
  onChange,
}: Readonly<{
  name: string;
  question: string;
  errors: Record<string, string[]> | undefined;
  onChange?: (value: string) => void;
}>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-boyd-light-300">{question}</legend>
      <div className="grid grid-cols-2 gap-3">
        {(['yes', 'no'] as const).map((value) => (
          <label
            key={value}
            className="flex items-center justify-center gap-2 rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100 has-checked:border-boyd-blue-500 has-checked:bg-boyd-blue-600/20"
          >
            <input
              type="radio"
              name={name}
              value={value}
              required
              className="h-5 w-5"
              onChange={() => onChange?.(value)}
            />
            {value === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </div>
      <FieldError errors={errors} name={name} />
    </fieldset>
  );
}
