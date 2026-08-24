'use client';

import { useActionState } from 'react';
import { advanceDriverJob, recordDriverMileage } from '../../../actions';
import type { FormState } from '@/app/(ops)/customers/actions';
import type { Transition } from '@/services/jobs/state-machine';

/**
 * The driver's actions.
 *
 * One large button per available step. Minimal typing, big touch targets,
 * nothing commercial — there is no price, cost or contribution anywhere on this
 * screen, and no way to reach one from it.
 */
export function DriverJobActions({
  jobId,
  transitions,
}: Readonly<{ jobId: string; transitions: readonly Transition[] }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    advanceDriverJob,
    {},
  );
  const [mileageState, mileageAction, mileagePending] = useActionState<
    FormState,
    FormData
  >(recordDriverMileage, {});

  return (
    <div className="mt-8 space-y-6">
      {transitions.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold tracking-[0.15em] text-boyd-light-400 uppercase">
            Next step
          </h2>
          <div className="space-y-3">
            {transitions.map((transition) => (
              <form key={transition.to} action={action}>
                <input type="hidden" name="jobId" value={jobId} />
                <input type="hidden" name="toStatus" value={transition.to} />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-lg bg-boyd-blue-600 px-4 py-4 text-base font-bold text-white active:bg-boyd-blue-500 disabled:opacity-50"
                >
                  {transition.to.replace(/_/g, ' ')}
                </button>
              </form>
            ))}
          </div>
          {state.error && (
            <p role="alert" className="mt-3 text-sm text-boyd-negative">
              {state.error}
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-bold tracking-[0.15em] text-boyd-light-400 uppercase">
          Record mileage
        </h2>
        <form action={mileageAction} className="space-y-3">
          <input type="hidden" name="jobId" value={jobId} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="startOdometer"
                className="mb-1 block text-sm text-boyd-light-300"
              >
                Start odometer
              </label>
              <input
                id="startOdometer"
                name="startOdometer"
                inputMode="decimal"
                className="w-full rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100"
              />
            </div>
            <div>
              <label
                htmlFor="endOdometer"
                className="mb-1 block text-sm text-boyd-light-300"
              >
                End odometer
              </label>
              <input
                id="endOdometer"
                name="endOdometer"
                inputMode="decimal"
                className="w-full rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="emptyMiles"
              className="mb-1 block text-sm text-boyd-light-300"
            >
              Empty miles (driven without a load)
            </label>
            <input
              id="emptyMiles"
              name="emptyMiles"
              inputMode="decimal"
              className="w-full rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100"
            />
          </div>

          {mileageState.error && (
            <p role="alert" className="text-sm text-boyd-negative">
              {mileageState.error}
            </p>
          )}
          {mileageState.success && (
            <p role="status" className="text-sm text-boyd-positive">
              {mileageState.success}
            </p>
          )}

          <button
            type="submit"
            disabled={mileagePending}
            className="w-full rounded-lg border border-boyd-navy-600 px-4 py-4 text-base font-bold text-boyd-light-200 active:bg-boyd-navy-800 disabled:opacity-50"
          >
            {mileagePending ? 'Saving…' : 'Save mileage'}
          </button>
        </form>
      </section>
    </div>
  );
}
