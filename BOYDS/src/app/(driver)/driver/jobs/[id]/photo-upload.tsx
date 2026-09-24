'use client';

import { useActionState } from 'react';
import { uploadJobPhoto } from '../../../actions';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Camera capture.
 *
 * `capture="environment"` opens the rear camera directly on a phone, so Moh
 * takes the photo without going through a file picker.
 */
export function PhotoUpload({
  jobId,
  documentType,
  label,
}: Readonly<{ jobId: string; documentType: string; label: string }>) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    uploadJobPhoto,
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="documentType" value={documentType} />

      <label
        htmlFor={`file-${documentType}`}
        className="block rounded-lg border-2 border-dashed border-boyd-navy-600 px-4 py-6 text-center text-boyd-light-300 active:bg-boyd-navy-800"
      >
        {label}
        <input
          id={`file-${documentType}`}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
      </label>

      {pending && <p className="text-sm text-boyd-light-400">Uploading…</p>}
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
    </form>
  );
}
