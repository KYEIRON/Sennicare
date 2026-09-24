/**
 * Result — an operation that can fail for an expected business reason.
 *
 * Domain operations return a Result rather than throwing, so the compiler forces
 * every caller to handle failure. Exceptions are reserved for programmer error.
 */

export type Result<T, E = DomainError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function domainError(
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): DomainError {
  return details === undefined ? { code, message } : { code, message, details };
}

/** Narrowing helpers, so call sites read as prose. */
export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return !r.ok;
}

/** Transform the success value, leaving a failure untouched. */
export function mapResult<T, U, E>(r: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

/**
 * Unwrap or throw. Use ONLY in tests and at the top of a request handler that
 * has already established the value must exist. Never as a shortcut around
 * handling a failure the business cares about.
 */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`Unwrapped a failed Result: ${JSON.stringify(r.error)}`);
}
