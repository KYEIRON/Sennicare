/**
 * Rate limiting for BOYD'S public endpoints.
 *
 * The delivery request form and the AI receptionist are reachable by anybody.
 * Without a limit, the request form is a route to filling BOYD'S queue with
 * noise, and the AI endpoint is a route to running up a bill on BOYD'S account.
 *
 * This is an in-memory limiter, which is the honest choice for a single
 * deployment: it works, and it resets when the process restarts. A distributed
 * limiter needs shared storage BOYD'S does not have yet. When it does, only this
 * file changes — see docs/DECISIONS.md D-028.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  /** When the window resets, for a Retry-After header. */
  readonly resetAt: Date;
}

export interface RateLimitRule {
  readonly limit: number;
  readonly windowMs: number;
}

/** What BOYD'S allows from one caller. */
export const RATE_LIMITS = {
  /** Delivery requests. Generous for a real customer, useless for a script. */
  DELIVERY_REQUEST: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** AI messages. Each one costs BOYD'S money. */
  AI_MESSAGE: { limit: 30, windowMs: 60 * 60 * 1000 },
  /** Sign-in attempts, to slow password guessing. */
  SIGN_IN: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/**
 * Drop expired windows.
 *
 * Called on each check rather than on a timer: a timer would keep the process
 * awake, and the map only grows when requests arrive anyway.
 */
function evictExpired(now: number): void {
  if (windows.size < 1000) return;

  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Check and consume one unit of a caller's allowance.
 *
 * `identifier` should be the most specific thing available — an IP address, or
 * a user id for an authenticated caller.
 */
export function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
  namespace: string,
): RateLimitResult {
  const now = Date.now();
  evictExpired(now);

  const key = `${namespace}:${identifier}`;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowMs;
    windows.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: rule.limit - 1, resetAt: new Date(resetAt) };
  }

  if (existing.count >= rule.limit) {
    return { allowed: false, remaining: 0, resetAt: new Date(existing.resetAt) };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: rule.limit - existing.count,
    resetAt: new Date(existing.resetAt),
  };
}

/**
 * Identify the caller.
 *
 * Reads the proxy headers a host sets. These are trustworthy only because the
 * host sets them — a client can send anything, so this must never be used for
 * authorisation. Rate limiting is the one thing it is fit for, and a caller who
 * spoofs a header to get a fresh allowance has achieved only that.
 */
export function callerIdentifier(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // The left-most entry is the original client.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown';
}

/** Clear all windows. Test use only. */
export function resetRateLimits(): void {
  windows.clear();
}
