/**
 * Validation schemas for authentication.
 *
 * The same module runs on the client for immediate feedback and on the server
 * for actual enforcement. The server never trusts the client's run of it.
 */

import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from '@/types/auth';

/** An upper bound on password length. Unbounded input is a denial-of-service route. */
const MAX_PASSWORD_LENGTH = 200;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .email('Enter a valid email address.')
  .transform((value) => value.toLowerCase());

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Enter your password.')
    .max(MAX_PASSWORD_LENGTH, 'That password is too long.'),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Minimum password length for BOYD'S accounts.
 *
 * Twelve characters with no composition rules. Length is what resists guessing;
 * forced symbol classes mainly produce predictable substitutions.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, 'That password is too long.');

export const userRoleSchema = z.enum(USER_ROLES);
export const userStatusSchema = z.enum(USER_STATUSES);

/** Creating a BOYD'S user. Role is explicit — there is no default. */
export const createUserSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().min(1, 'Enter a first name.').max(100),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  role: userRoleSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
