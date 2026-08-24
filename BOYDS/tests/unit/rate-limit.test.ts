import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMITS,
  callerIdentifier,
  checkRateLimit,
  resetRateLimits,
} from '@/lib/rate-limit';

beforeEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

const RULE = { limit: 3, windowMs: 60_000 };

describe('rate limiting', () => {
  it('allows requests up to the limit', () => {
    for (let attempt = 1; attempt <= RULE.limit; attempt += 1) {
      const result = checkRateLimit(RULE, '1.2.3.4', 'test');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RULE.limit - attempt);
    }
  });

  it('refuses the one after', () => {
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit(RULE, '1.2.3.4', 'test');

    const result = checkRateLimit(RULE, '1.2.3.4', 'test');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('counts each caller separately', () => {
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit(RULE, '1.2.3.4', 'test');

    expect(checkRateLimit(RULE, '5.6.7.8', 'test').allowed).toBe(true);
  });

  it('counts each namespace separately', () => {
    // Sending delivery requests must not use up someone's AI allowance.
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit(RULE, '1.2.3.4', 'requests');

    expect(checkRateLimit(RULE, '1.2.3.4', 'ai').allowed).toBe(true);
  });

  it('allows again once the window passes', () => {
    vi.useFakeTimers();

    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit(RULE, '1.2.3.4', 'test');
    expect(checkRateLimit(RULE, '1.2.3.4', 'test').allowed).toBe(false);

    vi.advanceTimersByTime(RULE.windowMs + 1);
    expect(checkRateLimit(RULE, '1.2.3.4', 'test').allowed).toBe(true);
  });

  it('reports when the window resets', () => {
    const result = checkRateLimit(RULE, '1.2.3.4', 'test');
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('the configured limits are sensible for a real business', () => {
  it('allows a real customer to send several requests in an hour', () => {
    // A customer who mistypes an address and resubmits must not be blocked.
    expect(RATE_LIMITS.DELIVERY_REQUEST.limit).toBeGreaterThanOrEqual(3);
    expect(RATE_LIMITS.DELIVERY_REQUEST.limit).toBeLessThanOrEqual(20);
  });

  it('caps AI messages, because each one costs BOYD’S money', () => {
    expect(RATE_LIMITS.AI_MESSAGE.limit).toBeLessThanOrEqual(60);
  });

  it('limits sign-in attempts tightly enough to slow guessing', () => {
    expect(RATE_LIMITS.SIGN_IN.limit).toBeLessThanOrEqual(15);
    expect(RATE_LIMITS.SIGN_IN.windowMs).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});

describe('identifying the caller', () => {
  it('reads the left-most forwarded address', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 10.0.0.2' });
    expect(callerIdentifier(headers)).toBe('1.2.3.4');
  });

  it('falls back through the other proxy headers', () => {
    expect(callerIdentifier(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(callerIdentifier(new Headers({ 'cf-connecting-ip': '9.9.9.9' }))).toBe(
      '9.9.9.9',
    );
  });

  it('returns a stable value when nothing identifies the caller', () => {
    // Everyone unidentified shares one bucket. That is the safe direction: it
    // limits more, not less.
    expect(callerIdentifier(new Headers())).toBe('unknown');
  });
});
