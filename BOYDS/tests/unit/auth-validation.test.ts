import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  createUserSchema,
  emailSchema,
  newPasswordSchema,
  signInSchema,
} from '@/validation/auth';

describe('email validation', () => {
  it('accepts a valid address and normalises it', () => {
    const result = emailSchema.safeParse('  Partner@BOYDS.example  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('partner@boyds.example');
  });

  it.each(['', 'not-an-email', '@boyds.example', 'partner@', 'partner @boyds.example'])(
    'rejects %p',
    (input) => {
      expect(emailSchema.safeParse(input).success).toBe(false);
    },
  );

  it('rejects an absurdly long address rather than passing it to the database', () => {
    const long = `${'a'.repeat(250)}@boyds.example`;
    expect(emailSchema.safeParse(long).success).toBe(false);
  });
});

describe('sign-in validation', () => {
  it('accepts a complete submission', () => {
    const result = signInSchema.safeParse({
      email: 'partner@boyds.example',
      password: 'a-sufficiently-long-password',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing password', () => {
    const result = signInSchema.safeParse({
      email: 'partner@boyds.example',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('caps password length, so an unbounded string cannot be submitted', () => {
    const result = signInSchema.safeParse({
      email: 'partner@boyds.example',
      password: 'x'.repeat(5000),
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string input rather than coercing it', () => {
    expect(signInSchema.safeParse({ email: 12345, password: null }).success).toBe(false);
  });
});

describe('new password rules', () => {
  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(newPasswordSchema.safeParse('x'.repeat(MIN_PASSWORD_LENGTH - 1)).success).toBe(
      false,
    );
    expect(newPasswordSchema.safeParse('x'.repeat(MIN_PASSWORD_LENGTH)).success).toBe(
      true,
    );
  });

  it('does not impose composition rules that produce predictable substitutions', () => {
    // A long passphrase with no digits or symbols is accepted. Length resists
    // guessing; forced character classes mostly produce "P@ssw0rd!".
    expect(newPasswordSchema.safeParse('correct horse battery staple').success).toBe(
      true,
    );
  });
});

describe('user creation', () => {
  it('requires an explicit role — there is no default', () => {
    const withoutRole = createUserSchema.safeParse({
      email: 'someone@boyds.example',
      firstName: 'Someone',
    });
    expect(withoutRole.success).toBe(false);
  });

  it('rejects an unknown role', () => {
    const result = createUserSchema.safeParse({
      email: 'someone@boyds.example',
      firstName: 'Someone',
      role: 'SUPERUSER',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid partner', () => {
    const result = createUserSchema.safeParse({
      email: 'someone@boyds.example',
      firstName: 'Someone',
      role: 'PARTNER',
    });
    expect(result.success).toBe(true);
  });

  it('requires a first name', () => {
    const result = createUserSchema.safeParse({
      email: 'someone@boyds.example',
      firstName: '   ',
      role: 'DRIVER',
    });
    expect(result.success).toBe(false);
  });
});
