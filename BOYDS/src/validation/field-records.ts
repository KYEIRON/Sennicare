/**
 * Validation for what a driver records in the field.
 *
 * Written for a phone: forgiving about formatting, strict about meaning. An
 * amount can be typed as "41.38" or "$41.38"; it cannot be typed as nothing and
 * quietly become zero.
 */

import { z } from 'zod';
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from '@/integrations/storage/types';

/** A required dollar amount, as typed, converted to integer cents. */
const requiredUsdCents = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const raw = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const cleaned = raw.replace(/[$\s]/g, '');

  if (cleaned === '') {
    ctx.addIssue({ code: 'custom', message: 'Enter the amount.' });
    return 0;
  }
  if (!/^(\d{1,3}(,\d{3})*|\d+)(\.\d{1,2})?$/.test(cleaned)) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid dollar amount.' });
    return 0;
  }

  const [whole = '0', fraction = ''] = cleaned.replace(/,/g, '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (cents <= 0) {
    ctx.addIssue({ code: 'custom', message: 'The amount must be more than zero.' });
  }
  return cents;
});

const positiveDecimal = (label: string, unit: number) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ctx.addIssue({ code: 'custom', message: `Enter ${label}.` });
      return 0;
    }
    return Math.round(parsed * unit);
  });

export const expenseSchema = z.object({
  jobId: z.string().uuid().nullable().optional(),
  category: z.enum(['FUEL', 'TOLL', 'PARKING', 'MAINTENANCE', 'SUPPLIES', 'OTHER']),
  amountCents: requiredUsdCents,
  description: z.string().trim().max(500).optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/**
 * Recording fuel.
 *
 * The total is entered separately from gallons and price per gallon, because
 * the receipt total is the fact — pumps round, and BOYD'S records what was
 * actually paid rather than a figure derived from two other figures.
 */
export const fuelSchema = z.object({
  jobId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid('Choose a vehicle.'),
  gallonsThousandths: positiveDecimal('the gallons', 1000),
  pricePerGallonCents: positiveDecimal('the price per gallon', 100),
  totalCostCents: requiredUsdCents,
  odometerTenths: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : Number(String(value).trim());
      return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) : null;
    }),
  station: z.string().trim().max(150).optional(),
});

export type FuelInput = z.infer<typeof fuelSchema>;

/** An uploaded file, checked before it reaches storage. */
export const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive('The file is empty.')
    .max(MAX_UPLOAD_BYTES, 'That file is too large. The limit is 25 MB.'),
});

export const signatureSchema = z.object({
  jobId: z.string().uuid(),
  signedByName: z
    .string()
    .trim()
    .min(1, 'Enter the name of the person signing.')
    .max(200),
  /** A data URL from the signature canvas. */
  imageData: z
    .string()
    .regex(
      /^data:image\/png;base64,[A-Za-z0-9+/=]+$/,
      'The signature could not be read.',
    ),
});

export type SignatureInput = z.infer<typeof signatureSchema>;

/** Decode a signature data URL, enforcing the size limit before storing it. */
export function decodeSignature(imageData: string): Buffer | null {
  const base64 = imageData.split(',')[1];
  if (!base64) return null;

  const buffer = Buffer.from(base64, 'base64');
  return buffer.byteLength > 0 && buffer.byteLength <= MAX_UPLOAD_BYTES ? buffer : null;
}
