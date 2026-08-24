'use client';

import { useActionState, useRef, useState } from 'react';
import { captureSignature } from '../../../actions';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Signature capture on the phone.
 *
 * A canvas the recipient signs with a finger. The image is stored privately and
 * linked to the job with the signer's name as they gave it — the name is typed
 * in, never inferred from the customer record, because the person who signs is
 * often not the person on the account.
 */
export function SignaturePad({ jobId }: Readonly<{ jobId: string }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    captureSignature,
    {},
  );

  function positionOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    const { x, y } = positionOf(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.strokeStyle = '#0a1628';
    canvasRef.current?.setPointerCapture(event.pointerId);
    setHasDrawn(true);
  }

  function continueStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.buttons === 0) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    const { x, y } = positionOf(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function attachImage(formData: FormData) {
    const canvas = canvasRef.current;
    if (canvas) formData.set('imageData', canvas.toDataURL('image/png'));
    return action(formData);
  }

  return (
    <form action={attachImage} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />

      <div>
        <label htmlFor="signedByName" className="mb-1 block text-sm text-boyd-light-300">
          Who is signing?
        </label>
        <input
          id="signedByName"
          name="signedByName"
          required
          maxLength={200}
          autoComplete="off"
          className="w-full rounded-lg border border-boyd-navy-700 bg-boyd-navy-950 px-4 py-3.5 text-lg text-boyd-light-100"
        />
        {state.fieldErrors?.signedByName?.[0] && (
          <p className="mt-1 text-sm text-boyd-negative">
            {state.fieldErrors.signedByName[0]}
          </p>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={220}
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        aria-label="Signature area"
        className="h-40 w-full touch-none rounded-lg border-2 border-boyd-navy-600 bg-white"
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={clear}
          className="flex-1 rounded-lg border border-boyd-navy-600 px-4 py-3.5 font-semibold text-boyd-light-300 active:bg-boyd-navy-800"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={pending || !hasDrawn}
          className="flex-1 rounded-lg bg-boyd-blue-600 px-4 py-3.5 font-bold text-white active:bg-boyd-blue-500 disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save signature'}
        </button>
      </div>

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
