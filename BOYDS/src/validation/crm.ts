/**
 * Validation for the CRM and quoting.
 */

import { z } from 'zod';
import { JOB_PRIORITIES, REQUEST_SOURCES } from '@/types/operations';

export const LEAD_STAGES = [
  'NEW',
  'QUALIFIED',
  'CONTACTED',
  'CONVERSATION',
  'QUOTE_REQUESTED',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'WON',
  'FIRST_JOB',
  'REPEAT_CUSTOMER',
  'CONTRACT_OPPORTUNITY',
  'LOST',
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const QUOTE_STATUSES = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'WITHDRAWN',
] as const;

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

const optionalUsdCents = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === '') return null;

    const cleaned = (typeof value === 'number' ? value.toFixed(2) : value.trim()).replace(
      /[$\s]/g,
      '',
    );
    if (!/^(\d{1,3}(,\d{3})*|\d+)(\.\d{1,2})?$/.test(cleaned)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid dollar amount.' });
      return null;
    }

    const [whole = '0', fraction = ''] = cleaned.replace(/,/g, '').split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  });

export const leadSchema = z
  .object({
    companyName: z.string().trim().min(1, 'Enter the company name.').max(200),
    contactName: optionalText(200),
    contactEmail: z
      .string()
      .trim()
      .email('Enter a valid email address.')
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    contactPhone: optionalText(40),
    stage: z.enum(LEAD_STAGES).default('NEW'),
    source: z.enum(REQUEST_SOURCES).default('PARTNER'),
    serviceInterest: optionalText(300),
    estimatedValueCents: optionalUsdCents,
    nextFollowupAt: z
      .string()
      .date()
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    isRecurringOpportunity: z.boolean().default(false),
    recurringDetail: optionalText(1000),
    lostReason: optionalText(500),
    notes: optionalText(4000),
  })
  // A lost lead records why. The reason is the data that improves targeting,
  // and without it the pipeline teaches BOYD'S nothing.
  .refine((lead) => lead.stage !== 'LOST' || (lead.lostReason?.trim().length ?? 0) > 0, {
    message: 'Say why this lead was lost.',
    path: ['lostReason'],
  });

export type LeadInput = z.infer<typeof leadSchema>;

/**
 * Creating a quote.
 *
 * Estimated miles are required: without a distance there is no cost estimate,
 * and a quote with no cost behind it is exactly the invented quote BOYD'S
 * forbids.
 */
export const quoteSchema = z.object({
  customerId: z.string().uuid('Choose a customer.'),
  leadId: z.string().uuid().nullable().optional(),
  jobTypeId: z.string().uuid('Choose a job type.'),
  priority: z.enum(JOB_PRIORITIES).default('STANDARD'),
  collectionSummary: optionalText(300),
  deliverySummary: optionalText(300),
  requestedDate: z
    .string()
    .date()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  estimatedMiles: z.union([z.string(), z.number()]).transform((value, ctx) => {
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter the estimated distance in miles.' });
      return 0;
    }
    return Math.round(parsed * 10);
  }),
  quotedPriceCents: z.union([z.string(), z.number()]).transform((value, ctx) => {
    const cleaned = (typeof value === 'number' ? value.toFixed(2) : value.trim()).replace(
      /[$\s,]/g,
      '',
    );
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      ctx.addIssue({ code: 'custom', message: 'Enter the price you are quoting.' });
      return 0;
    }
    const [whole = '0', fraction = ''] = cleaned.split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  }),
  validUntil: z
    .string()
    .date()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  terms: optionalText(2000),
  overrideReason: optionalText(500),
  notes: optionalText(2000),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
