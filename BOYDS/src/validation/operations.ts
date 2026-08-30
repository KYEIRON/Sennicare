/**
 * Validation for BOYD'S operational records.
 *
 * The same schemas run on the client for immediate feedback and on the server
 * for enforcement. The server never trusts the client's run of them.
 *
 * A recurring theme: an optional field that is left blank becomes `null`, which
 * the system reads as NOT CONFIGURED. It never becomes an empty string or a
 * zero, because an unknown purchase price is not a free van.
 */

import { z } from 'zod';
import {
  CONTACT_ROLES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  DRIVER_AVAILABILITIES,
  DRIVER_STATUSES,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  JOB_PRIORITIES,
  LOCATION_KINDS,
  REQUEST_SOURCES,
  STOP_TYPES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from '@/types/operations';
import type { VehicleStatus } from '@/types/operations';

/** A blank optional input means "not recorded", never an empty string. */
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

const usState = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use a two-letter state code, such as NC.');

const usZip = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, 'Use a 5-digit ZIP code, optionally ZIP+4.');

const phone = z.string().trim().max(40);

/**
 * A US dollar amount as typed by a person, converted to integer cents.
 *
 * Blank means not recorded — NOT zero. A van with no purchase price recorded
 * did not cost nothing.
 */
const optionalUsdCents = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === '') return null;

    const raw = typeof value === 'number' ? value.toFixed(2) : value.trim();
    const cleaned = raw.replace(/[$\s]/g, '');

    if (!/^(\d{1,3}(,\d{3})*|\d+)(\.\d{1,2})?$/.test(cleaned)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid dollar amount.' });
      return null;
    }

    const [whole = '0', fraction = ''] = cleaned.replace(/,/g, '').split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  });

/** Miles as typed, converted to integer tenths. Blank means not recorded. */
const optionalMilesTenths = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === '') return null;

    const parsed = typeof value === 'number' ? value : Number(value.trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter a distance in miles.' });
      return null;
    }
    return Math.round(parsed * 10);
  });

// --- Customers ---------------------------------------------------------------

export const customerSchema = z.object({
  companyName: z.string().trim().min(1, 'Enter the company or customer name.').max(200),
  customerType: z.enum(CUSTOMER_TYPES),
  customerStatus: z.enum(CUSTOMER_STATUSES).default('PROSPECT'),
  industryId: z.string().uuid().nullable().optional(),
  paymentTermsDays: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value) => {
      // Blank stays NULL — BOYD'S payment terms are NOT CONFIGURED and no
      // default is invented here.
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isInteger(parsed) && parsed >= 0 && parsed <= 180 ? parsed : null;
    }),
  leadSource: optionalText(200),
  notes: optionalText(4000),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const customerContactSchema = z.object({
  name: z.string().trim().min(1, 'Enter the contact name.').max(200),
  role: z.enum(CONTACT_ROLES).default('PRIMARY'),
  jobTitle: optionalText(150),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  phone: phone.nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: optionalText(2000),
});

export const customerLocationSchema = z.object({
  kind: z.enum(LOCATION_KINDS).default('SERVICE'),
  label: optionalText(150),
  addressLine1: z.string().trim().min(1, 'Enter the street address.').max(200),
  addressLine2: optionalText(200),
  city: z.string().trim().min(1, 'Enter the city.').max(120),
  state: usState,
  zip: usZip,
  contactName: optionalText(200),
  contactPhone: phone.nullable().optional(),
  instructions: optionalText(2000),
  isDefault: z.boolean().default(false),
});

// --- Vehicles ----------------------------------------------------------------

/**
 * Every specification is optional on purpose.
 *
 * BOYD'S supplies a VIN, plate, make, model, year, purchase price and insurance
 * details from real documents. Until then each stays null and the interface
 * shows NOT CONFIGURED rather than an invented value.
 */
export const vehicleSchema = z.object({
  vehicleCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter a vehicle code, such as BOYD-001.')
    .max(30)
    .regex(/^[A-Z0-9-]+$/, 'Use letters, numbers and hyphens only.'),
  licensePlate: optionalText(20),
  licenseState: usState
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .length(17, 'A VIN is exactly 17 characters.')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  make: optionalText(80),
  model: optionalText(80),
  year: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isInteger(parsed) && parsed >= 1980 && parsed <= 2100 ? parsed : null;
    }),
  vehicleType: z.enum(VEHICLE_TYPES).nullable().optional(),
  purchaseDate: z
    .string()
    .date()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  purchasePriceCents: optionalUsdCents,
  currentOdometerTenths: optionalMilesTenths,
  insuranceProvider: optionalText(150),
  insurancePolicyNumber: optionalText(100),
  insuranceRenewalDate: z
    .string()
    .date()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  insuranceCostCents: optionalUsdCents,
  notes: optionalText(4000),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

/**
 * Statuses a partner may set directly.
 *
 * ASSIGNED and IN_TRANSIT are consequences of job activity and are deliberately
 * absent: a van is not "in transit" because someone selected it from a menu.
 */
export const PARTNER_SETTABLE_VEHICLE_STATUSES: readonly VehicleStatus[] =
  VEHICLE_STATUSES.filter((status) => status !== 'ASSIGNED' && status !== 'IN_TRANSIT');

export const vehicleStatusChangeSchema = z.object({
  status: z
    .enum(VEHICLE_STATUSES)
    .refine(
      (status) => PARTNER_SETTABLE_VEHICLE_STATUSES.includes(status),
      'That status is set by job activity, not by editing.',
    ),
  reason: z.string().trim().min(1, 'Give a reason for the change.').max(500),
});

// --- Drivers -----------------------------------------------------------------

export const driverSchema = z.object({
  licenseNumber: optionalText(50),
  licenseState: usState
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  licenseExpiry: z
    .string()
    .date()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  phone: phone.nullable().optional(),
  status: z.enum(DRIVER_STATUSES).default('ACTIVE'),
  availability: z.enum(DRIVER_AVAILABILITIES).default('AVAILABLE'),
  currentLocation: optionalText(200),
  notes: optionalText(4000),
});

export type DriverInput = z.infer<typeof driverSchema>;

// --- Jobs --------------------------------------------------------------------

export const jobStopSchema = z.object({
  sequence: z.number().int().positive(),
  stopType: z.enum(STOP_TYPES),
  customerLocationId: z.string().uuid().nullable().optional(),
  addressLine1: z.string().trim().min(1, 'Enter the street address.').max(200),
  addressLine2: optionalText(200),
  city: z.string().trim().min(1, 'Enter the city.').max(120),
  state: usState,
  zip: usZip,
  contactName: optionalText(200),
  contactPhone: phone.nullable().optional(),
  instructions: optionalText(2000),
  scheduledDate: z.string().date().nullable().optional(),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use a 24-hour time such as 14:30.')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  windowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use a 24-hour time such as 16:30.')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

export type JobStopInput = z.infer<typeof jobStopSchema>;

/**
 * Creating a job.
 *
 * A job must have a customer, a type, and at least one pickup and one delivery.
 * An incomplete job cannot be created, which is what stops half-finished work
 * appearing on the schedule as though BOYD'S had committed to it.
 */
export const createJobSchema = z
  .object({
    customerId: z.string().uuid('Choose a customer.'),
    customerContactId: z.string().uuid().nullable().optional(),
    jobTypeId: z.string().uuid('Choose a job type.'),
    priority: z.enum(JOB_PRIORITIES).default('STANDARD'),
    source: z.enum(REQUEST_SOURCES).default('PARTNER'),

    description: optionalText(2000),
    quantity: z.number().int().min(0).nullable().optional(),
    weightLbs: z.number().min(0).nullable().optional(),
    dimensions: optionalText(200),
    pallets: z.number().int().min(0).nullable().optional(),
    specialHandling: optionalText(1000),

    scheduledDate: z.string().date().nullable().optional(),
    scheduledTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    scheduledWindowEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),

    estimatedMilesTenths: optionalMilesTenths,
    quotedPriceCents: optionalUsdCents,

    notes: optionalText(4000),
    stops: z.array(jobStopSchema).min(2, 'A job needs a pickup and a delivery.'),
  })
  .refine((job) => job.stops.some((s) => s.stopType === 'PICKUP'), {
    message: 'A job needs at least one pickup.',
    path: ['stops'],
  })
  .refine((job) => job.stops.some((s) => s.stopType === 'DELIVERY'), {
    message: 'A job needs at least one delivery.',
    path: ['stops'],
  })
  .refine(
    (job) => {
      const sequences = job.stops.map((s) => s.sequence);
      return new Set(sequences).size === sequences.length;
    },
    { message: 'Each stop needs a distinct position in the route.', path: ['stops'] },
  )
  .refine(
    (job) => {
      // The last pickup must come before the first delivery. Multi-stop work is
      // supported; delivering before collecting is not.
      const lastPickup = Math.max(
        ...job.stops.filter((s) => s.stopType === 'PICKUP').map((s) => s.sequence),
      );
      const firstDelivery = Math.min(
        ...job.stops.filter((s) => s.stopType === 'DELIVERY').map((s) => s.sequence),
      );
      return lastPickup < firstDelivery;
    },
    { message: 'Every pickup must come before the first delivery.', path: ['stops'] },
  );

export type CreateJobInput = z.infer<typeof createJobSchema>;

/** Recording actual costs. Every field optional; a blank stays MISSING. */
export const jobCostsSchema = z.object({
  fuelCostActualCents: optionalUsdCents,
  driverCostActualCents: optionalUsdCents,
  vehicleCostActualCents: optionalUsdCents,
  tollCostActualCents: optionalUsdCents,
  parkingCostActualCents: optionalUsdCents,
  otherCostActualCents: optionalUsdCents,
  wonPriceCents: optionalUsdCents,
});

/** Recording mileage. Loaded plus empty must account for the total. */
export const jobMileageSchema = z
  .object({
    actualMilesTenths: optionalMilesTenths,
    loadedMilesTenths: optionalMilesTenths,
    emptyMilesTenths: optionalMilesTenths,
  })
  .refine(
    (m) =>
      m.actualMilesTenths === null ||
      m.loadedMilesTenths === null ||
      m.emptyMilesTenths === null ||
      m.loadedMilesTenths + m.emptyMilesTenths === m.actualMilesTenths,
    {
      message: 'Loaded plus empty miles must equal the total.',
      path: ['emptyMilesTenths'],
    },
  );

export const assignJobSchema = z.object({
  vehicleId: z.string().uuid('Choose a vehicle.'),
  driverId: z.string().uuid('Choose a driver.'),
  scheduledDate: z.string().date('Set a scheduled date.'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'Set a scheduled time.'),
  scheduledWindowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

// --- Incidents ---------------------------------------------------------------

/**
 * A driver's report of what happened.
 *
 * The three yes/no questions are required rather than defaulted. "Nobody was
 * hurt" and "he did not say" are different answers, and an insurer will ask
 * which one this is.
 *
 * There is no cost field. At the roadside nobody knows what it cost, and a
 * figure entered under pressure would be a guess that later reads as a fact.
 */
const requiredYesNo = (message: string) =>
  z.enum(['yes', 'no'], { message }).transform((v) => v === 'yes');

export const incidentReportSchema = z
  .object({
    jobId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    incidentType: z.enum(INCIDENT_TYPES, { message: 'Choose what happened.' }),
    severity: z.enum(INCIDENT_SEVERITIES, { message: 'Say how serious it is.' }),
    occurredAt: z.string().min(1, 'When did it happen?'),
    locationDescription: optionalText(300),
    description: z
      .string()
      .trim()
      .min(10, 'Describe what happened, in your own words.')
      .max(4000),
    anyoneInjured: requiredYesNo('Say whether anyone was hurt.'),
    policeInvolved: requiredYesNo('Say whether the police were involved.'),
    policeReportNumber: optionalText(100),
    thirdPartyInvolved: requiredYesNo('Say whether anyone else was involved.'),
    thirdPartyDetails: optionalText(2000),
    goodsAffected: requiredYesNo('Say whether the load was affected.'),
  })
  .refine((r) => r.policeInvolved || !r.policeReportNumber, {
    message: 'A police report number only makes sense if the police were involved.',
    path: ['policeReportNumber'],
  })
  .refine((r) => r.thirdPartyInvolved || !r.thirdPartyDetails, {
    message: 'Only give other-party details if someone else was involved.',
    path: ['thirdPartyDetails'],
  });

export type IncidentReportInput = z.infer<typeof incidentReportSchema>;

/** A partner closing an incident off. Resolving requires saying how. */
export const incidentReviewSchema = z
  .object({
    incidentId: z.string().uuid(),
    status: z.enum(['REPORTED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED']),
    resolutionNotes: optionalText(4000),
    costCents: optionalUsdCents,
  })
  .refine(
    (r) => (r.status !== 'RESOLVED' && r.status !== 'CLOSED') || !!r.resolutionNotes,
    {
      message: 'Say how it was resolved before closing it.',
      path: ['resolutionNotes'],
    },
  );
