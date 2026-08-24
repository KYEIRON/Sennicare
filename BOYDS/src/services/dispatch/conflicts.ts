/**
 * Dispatch conflict detection.
 *
 * Mirrors find_dispatch_conflicts() in migration 0010. This layer gives a
 * partner every conflict at once, in plain language, before they commit an
 * assignment; the database rejects one that slips through anyway.
 *
 * Written for N vehicles and N drivers. BOYD'S runs one van today, and nothing
 * here assumes that.
 */

import type {
  JobStatus,
  VehicleStatus,
  DriverStatus,
  DriverAvailability,
} from '@/types/operations';
import { RESOURCE_OCCUPYING_STATUSES } from '@/types/operations';

export const CONFLICT_TYPES = [
  'VEHICLE_DOUBLE_BOOKED',
  'DRIVER_DOUBLE_BOOKED',
  'VEHICLE_UNAVAILABLE',
  'DRIVER_UNAVAILABLE',
  'NO_VEHICLE',
  'NO_DRIVER',
  'NOT_SCHEDULED',
] as const;

export type ConflictType = (typeof CONFLICT_TYPES)[number];

export interface DispatchConflict {
  readonly type: ConflictType;
  readonly detail: string;
  readonly conflictingJobId?: string;
  readonly conflictingJobNumber?: string;
}

/** Minutes a job is assumed to occupy when no window end is given. */
export const DEFAULT_JOB_WINDOW_MINUTES = 120;

export interface TimeWindow {
  readonly startMinutes: number;
  readonly endMinutes: number;
}

/** Parse "HH:MM" or "HH:MM:SS" into minutes since midnight. */
export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})(:\d{2})?$/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * The window a job occupies on its scheduled day.
 *
 * The default block when no end time is given is a SCHEDULING assumption. It
 * exists so overlapping work can be spotted; it never reaches a cost or a
 * contribution figure.
 */
export function jobWindow(
  scheduledTime: string | null,
  windowEnd: string | null,
): TimeWindow | null {
  if (!scheduledTime) return null;

  const startMinutes = parseTimeToMinutes(scheduledTime);
  if (startMinutes === null) return null;

  const parsedEnd = windowEnd ? parseTimeToMinutes(windowEnd) : null;
  const endMinutes =
    parsedEnd !== null && parsedEnd > startMinutes
      ? parsedEnd
      : startMinutes + DEFAULT_JOB_WINDOW_MINUTES;

  return { startMinutes, endMinutes };
}

/** Half-open overlap: a job ending at 14:00 does not conflict with one starting then. */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export function occupiesResources(status: JobStatus): boolean {
  return RESOURCE_OCCUPYING_STATUSES.includes(status);
}

export interface ScheduledJob {
  readonly id: string;
  readonly jobNumber: string;
  readonly status: JobStatus;
  readonly vehicleId: string | null;
  readonly driverId: string | null;
  readonly scheduledDate: string | null;
  readonly scheduledTime: string | null;
  readonly windowEnd: string | null;
}

export interface AssignmentProposal {
  readonly jobId: string;
  readonly vehicleId: string | null;
  readonly driverId: string | null;
  readonly scheduledDate: string | null;
  readonly scheduledTime: string | null;
  readonly windowEnd: string | null;
}

export interface VehicleAvailability {
  readonly id: string;
  readonly vehicleCode: string;
  readonly status: VehicleStatus;
  readonly active: boolean;
}

export interface DriverAvailabilityRecord {
  readonly id: string;
  readonly status: DriverStatus;
  readonly availability: DriverAvailability;
  readonly active: boolean;
}

const UNAVAILABLE_VEHICLE_STATUSES: readonly VehicleStatus[] = [
  'MAINTENANCE',
  'OUT_OF_SERVICE',
  'INACTIVE',
];

export function isVehicleAssignable(vehicle: VehicleAvailability): boolean {
  return vehicle.active && !UNAVAILABLE_VEHICLE_STATUSES.includes(vehicle.status);
}

export function isDriverAssignable(driver: DriverAvailabilityRecord): boolean {
  return (
    driver.active && driver.status === 'ACTIVE' && driver.availability !== 'UNAVAILABLE'
  );
}

/**
 * Every reason a proposed assignment cannot proceed.
 *
 * Returns a list rather than the first problem, so a partner sees the whole
 * picture in one pass instead of fixing one conflict only to meet the next.
 */
export function findConflicts(
  proposal: AssignmentProposal,
  context: {
    readonly existingJobs: readonly ScheduledJob[];
    readonly vehicle?: VehicleAvailability | null;
    readonly driver?: DriverAvailabilityRecord | null;
  },
): readonly DispatchConflict[] {
  const conflicts: DispatchConflict[] = [];

  if (!proposal.vehicleId) {
    conflicts.push({ type: 'NO_VEHICLE', detail: 'No vehicle has been assigned.' });
  }
  if (!proposal.driverId) {
    conflicts.push({ type: 'NO_DRIVER', detail: 'No driver has been assigned.' });
  }

  if (context.vehicle && !isVehicleAssignable(context.vehicle)) {
    conflicts.push({
      type: 'VEHICLE_UNAVAILABLE',
      detail: context.vehicle.active
        ? `Vehicle ${context.vehicle.vehicleCode} is ${context.vehicle.status.replace(/_/g, ' ').toLowerCase()}.`
        : `Vehicle ${context.vehicle.vehicleCode} is not active.`,
    });
  }

  if (context.driver && !isDriverAssignable(context.driver)) {
    conflicts.push({
      type: 'DRIVER_UNAVAILABLE',
      detail: !context.driver.active
        ? 'That driver record is not active.'
        : context.driver.status !== 'ACTIVE'
          ? `That driver is ${context.driver.status.toLowerCase()}.`
          : 'That driver is marked unavailable.',
    });
  }

  const proposedWindow = jobWindow(proposal.scheduledTime, proposal.windowEnd);

  if (!proposal.scheduledDate || !proposedWindow) {
    conflicts.push({
      type: 'NOT_SCHEDULED',
      detail: 'A job needs a scheduled date and time before it can be assigned.',
    });
    return conflicts;
  }

  for (const existing of context.existingJobs) {
    if (existing.id === proposal.jobId) continue;
    if (!occupiesResources(existing.status)) continue;
    if (existing.scheduledDate !== proposal.scheduledDate) continue;

    const existingWindow = jobWindow(existing.scheduledTime, existing.windowEnd);
    if (!existingWindow || !windowsOverlap(proposedWindow, existingWindow)) continue;

    if (proposal.vehicleId && existing.vehicleId === proposal.vehicleId) {
      conflicts.push({
        type: 'VEHICLE_DOUBLE_BOOKED',
        detail: `That vehicle is already committed to ${existing.jobNumber} at that time.`,
        conflictingJobId: existing.id,
        conflictingJobNumber: existing.jobNumber,
      });
    }

    if (proposal.driverId && existing.driverId === proposal.driverId) {
      conflicts.push({
        type: 'DRIVER_DOUBLE_BOOKED',
        detail: `That driver is already committed to ${existing.jobNumber} at that time.`,
        conflictingJobId: existing.id,
        conflictingJobNumber: existing.jobNumber,
      });
    }
  }

  return conflicts;
}

/** True when an assignment may proceed. */
export function canAssign(conflicts: readonly DispatchConflict[]): boolean {
  return conflicts.length === 0;
}
