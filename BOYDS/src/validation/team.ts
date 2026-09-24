import { z } from 'zod';
import { USER_ROLES } from '@/types/auth';

/**
 * The Team screen's inputs.
 *
 * Email is optional on purpose: a real colleague can be recorded before their
 * address is known. It is never guessed, and a blank stays blank — never a
 * placeholder.
 */

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v.length === 0 ? null : v))
  .pipe(z.string().email('That does not look like an email address.').nullable());

const requiredEmail = z.string().trim().toLowerCase().email('Enter their email address.');

export const addPersonSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter their first name.').max(100),
    lastName: z
      .string()
      .trim()
      .max(100)
      .transform((v) => (v.length === 0 ? null : v)),
    email: optionalEmail,
    role: z.enum(USER_ROLES, { message: 'Choose a role.' }),
    isPartner: z.boolean(),
    partnerTitle: z
      .string()
      .trim()
      .max(150)
      .transform((v) => (v.length === 0 ? null : v)),
    isDriver: z.boolean(),
    sendInvitation: z.boolean(),
  })
  .refine((p) => !p.isPartner || !!p.partnerTitle, {
    message:
      'Give their role in the business, e.g. "Field & Vehicle Operations Partner".',
    path: ['partnerTitle'],
  });

export type AddPersonInput = z.infer<typeof addPersonSchema>;

export const personIdSchema = z.string().uuid();

export const addEmailSchema = z.object({
  personId: personIdSchema,
  email: requiredEmail,
  sendInvitation: z.boolean(),
});

export const changeRoleSchema = z.object({
  personId: personIdSchema,
  role: z.enum(USER_ROLES, { message: 'Choose a role.' }),
});

/** A new password. Long rather than complicated: length is what resists guessing. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(12, 'Use at least 12 characters.').max(200),
    confirm: z.string(),
  })
  .refine((p) => p.password === p.confirm, {
    message: 'The two passwords do not match.',
    path: ['confirm'],
  });
