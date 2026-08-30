/**
 * BOYD'S operational domain types.
 *
 * These mirror the Postgres enums in migration 0004. Tests assert the two
 * definitions agree, so a value added in one place cannot go missing in the
 * other.
 */

export const CUSTOMER_TYPES = ['BUSINESS', 'INDIVIDUAL', 'GOVERNMENT', 'OTHER'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_STATUSES = [
  'PROSPECT',
  'ACTIVE',
  'INACTIVE',
  'ON_HOLD',
  'LOST',
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CONTACT_ROLES = [
  'PRIMARY',
  'BILLING',
  'OPERATIONS',
  'SITE',
  'OTHER',
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const LOCATION_KINDS = [
  'BILLING',
  'SERVICE',
  'PICKUP',
  'DELIVERY',
  'OTHER',
] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const VEHICLE_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'IN_TRANSIT',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
  'INACTIVE',
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_TYPES = [
  'CARGO_VAN',
  'BOX_TRUCK',
  'SPRINTER_VAN',
  'PICKUP',
  'CAR',
  'OTHER',
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DRIVER_AVAILABILITIES = [
  'AVAILABLE',
  'ON_JOB',
  'OFF_DUTY',
  'UNAVAILABLE',
] as const;
export type DriverAvailability = (typeof DRIVER_AVAILABILITIES)[number];

/**
 * The BOYD'S job lifecycle.
 *
 * Follows the Phase 3 instruction, which supersedes the earlier list in
 * docs/DATABASE.md. See docs/DECISIONS.md D-019.
 */
export const JOB_STATUSES = [
  'REQUESTED',
  'REVIEW',
  'QUOTED',
  'APPROVED',
  'SCHEDULED',
  'ASSIGNED',
  'DRIVER_ACCEPTED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DELIVERY',
  'DELIVERED',
  'POD_RECEIVED',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'DECLINED',
  'FAILED',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PRIORITIES = [
  'STANDARD',
  'SCHEDULED',
  'SAME_DAY',
  'URGENT',
  'CRITICAL',
] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const STOP_TYPES = ['PICKUP', 'DELIVERY', 'INTERMEDIATE'] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const STOP_STATUSES = [
  'PENDING',
  'EN_ROUTE',
  'ARRIVED',
  'COMPLETED',
  'SKIPPED',
  'FAILED',
] as const;
export type StopStatus = (typeof STOP_STATUSES)[number];

export const COST_STATES = ['ESTIMATED', 'ACTUAL', 'MISSING'] as const;
export type CostState = (typeof COST_STATES)[number];

export const MILEAGE_TYPES = ['LOADED', 'EMPTY', 'PERSONAL_EXCLUDED'] as const;
export type MileageType = (typeof MILEAGE_TYPES)[number];

export const REQUEST_STATUSES = [
  'NEW',
  'UNDER_REVIEW',
  'QUOTED',
  'APPROVED',
  'DECLINED',
  'CONVERTED',
  'EXPIRED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_SOURCES = [
  'WEBSITE',
  'AI_RECEPTIONIST',
  'PHONE',
  'EMAIL',
  'PARTNER',
  'CUSTOMER_PORTAL',
] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];

/** Statuses in which a job occupies a vehicle and a driver. */
export const RESOURCE_OCCUPYING_STATUSES: readonly JobStatus[] = [
  'ASSIGNED',
  'DRIVER_ACCEPTED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DELIVERY',
  'DELIVERED',
  'POD_RECEIVED',
];

/** Statuses a job may be created at. Nothing is created mid-flight. */
export const INITIAL_JOB_STATUSES: readonly JobStatus[] = [
  'REQUESTED',
  'REVIEW',
  'QUOTED',
  'APPROVED',
];

/** Terminal statuses — no transition leads out of these. */
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'DECLINED',
];

// --- Incidents ---------------------------------------------------------------

/**
 * What went wrong.
 *
 * The list is deliberately concrete. A driver at the roadside picks the thing
 * that happened, not a category he has to interpret.
 */
export const INCIDENT_TYPES = [
  'ACCIDENT',
  'VEHICLE_BREAKDOWN',
  'VEHICLE_DAMAGE',
  'GOODS_DAMAGED',
  'GOODS_LOST',
  'THEFT',
  'CUSTOMER_UNAVAILABLE',
  'ACCESS_REFUSED',
  'DELAY',
  'WEATHER',
  'TRAFFIC_STOP',
  'INJURY',
  'OTHER',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_SEVERITIES = ['MINOR', 'SERIOUS', 'CRITICAL'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_STATUSES = [
  'REPORTED',
  'UNDER_REVIEW',
  'RESOLVED',
  'CLOSED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Plain English for each incident type, for a driver on a phone. */
export const INCIDENT_TYPE_LABELS: Readonly<Record<IncidentType, string>> = {
  ACCIDENT: 'Road accident',
  VEHICLE_BREAKDOWN: 'The van broke down',
  VEHICLE_DAMAGE: 'The van was damaged',
  GOODS_DAMAGED: 'The goods were damaged',
  GOODS_LOST: 'The goods were lost',
  THEFT: 'Theft',
  CUSTOMER_UNAVAILABLE: 'Nobody was there',
  ACCESS_REFUSED: 'Could not get access',
  DELAY: 'Held up',
  WEATHER: 'Weather',
  TRAFFIC_STOP: 'Stopped by the police',
  INJURY: 'Someone was hurt',
  OTHER: 'Something else',
};

export const INCIDENT_SEVERITY_LABELS: Readonly<Record<IncidentSeverity, string>> = {
  MINOR: 'Minor — worth recording',
  SERIOUS: 'Serious — a partner should know now',
  CRITICAL: 'Critical — someone hurt, or the van is off the road',
};
