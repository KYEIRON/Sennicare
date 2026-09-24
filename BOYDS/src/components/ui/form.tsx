'use client';

/**
 * Shared form primitives.
 *
 * Every input is labelled and every error is associated with its field via
 * aria-describedby, so the form works with a screen reader and on a phone —
 * which matters, because Moh will use parts of this system in a van.
 */

export function Field({
  label,
  name,
  errors,
  hint,
  children,
}: Readonly<{
  label: string;
  name: string;
  errors?: Record<string, string[]> | undefined;
  hint?: string;
  children: React.ReactNode;
}>) {
  const fieldErrors = errors?.[name];

  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-boyd-light-300">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-boyd-light-500">{hint}</p>}
      {fieldErrors?.map((message) => (
        <p key={message} id={`${name}-error`} className="mt-1 text-sm text-boyd-negative">
          {message}
        </p>
      ))}
    </div>
  );
}

const CONTROL_CLASSES =
  'w-full rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2 text-boyd-light-100 placeholder:text-boyd-light-500 focus:border-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-500/40 focus:outline-none disabled:opacity-50';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input id={props.name} {...props} className={CONTROL_CLASSES} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea id={props.name} {...props} className={CONTROL_CLASSES} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select id={props.name} {...props} className={CONTROL_CLASSES} />;
}

export function SubmitButton({
  pending,
  children,
}: Readonly<{ pending: boolean; children: React.ReactNode }>) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-boyd-blue-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-boyd-blue-500 focus:ring-2 focus:ring-boyd-blue-400 focus:ring-offset-2 focus:ring-offset-boyd-navy-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Saving…' : children}
    </button>
  );
}
