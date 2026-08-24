/**
 * The BOYD'S job lifecycle, in TypeScript.
 *
 * This is the mirror of `job_status_transitions` in migration 0009. A test
 * asserts the two are identical, so the lifecycle has one definition enforced at
 * two independent layers: here, for immediate feedback and clear errors, and in
 * Postgres, which is what actually holds if application code is wrong.
 *
 * A transition absent from this table cannot happen. COMPLETED -> REQUESTED is
 * rejected not by a special rule but because it simply is not listed.
 */

import type { JobStatus } from '@/types/operations';
import { RESOURCE_OCCUPYING_STATUSES, TERMINAL_JOB_STATUSES } from '@/types/operations';
import { domainError, err, ok, type Result } from '@/lib/result';

export interface Transition {
  readonly from: JobStatus;
  readonly to: JobStatus;
  readonly description: string;
}

export const JOB_TRANSITIONS: readonly Transition[] = [
  // Intake and commercial
  {
    from: 'REQUESTED',
    to: 'REVIEW',
    description: 'A partner picks the request up for review',
  },
  { from: 'REQUESTED', to: 'DECLINED', description: "BOYD'S declines the request" },
  {
    from: 'REQUESTED',
    to: 'CANCELLED',
    description: 'The customer withdraws before review',
  },
  { from: 'REVIEW', to: 'QUOTED', description: 'A price is quoted to the customer' },
  {
    from: 'REVIEW',
    to: 'APPROVED',
    description: 'Approved directly, without a formal quote',
  },
  { from: 'REVIEW', to: 'DECLINED', description: "BOYD'S declines after reviewing" },
  {
    from: 'REVIEW',
    to: 'ON_HOLD',
    description: 'Waiting on the customer or on information',
  },
  { from: 'REVIEW', to: 'CANCELLED', description: 'Cancelled during review' },
  { from: 'QUOTED', to: 'APPROVED', description: 'The customer accepts the quote' },
  { from: 'QUOTED', to: 'DECLINED', description: 'The customer declines the quote' },
  { from: 'QUOTED', to: 'REVIEW', description: 'Requoting — back to review' },
  { from: 'QUOTED', to: 'ON_HOLD', description: 'Quote issued, awaiting a decision' },
  { from: 'QUOTED', to: 'CANCELLED', description: 'Cancelled after quoting' },

  // Planning
  { from: 'APPROVED', to: 'SCHEDULED', description: 'Placed on the schedule' },
  { from: 'APPROVED', to: 'ON_HOLD', description: 'Approved but not yet schedulable' },
  { from: 'APPROVED', to: 'CANCELLED', description: 'Cancelled after approval' },
  { from: 'SCHEDULED', to: 'ASSIGNED', description: 'A vehicle and driver are assigned' },
  { from: 'SCHEDULED', to: 'ON_HOLD', description: 'Held before assignment' },
  { from: 'SCHEDULED', to: 'CANCELLED', description: 'Cancelled before assignment' },
  {
    from: 'ASSIGNED',
    to: 'DRIVER_ACCEPTED',
    description: 'The assigned driver accepts the job',
  },
  { from: 'ASSIGNED', to: 'SCHEDULED', description: 'Unassigned — back to the schedule' },
  { from: 'ASSIGNED', to: 'ON_HOLD', description: 'Held after assignment' },
  { from: 'ASSIGNED', to: 'CANCELLED', description: 'Cancelled after assignment' },

  // Field execution
  {
    from: 'DRIVER_ACCEPTED',
    to: 'EN_ROUTE_TO_PICKUP',
    description: 'The driver sets off for the pickup',
  },
  {
    from: 'DRIVER_ACCEPTED',
    to: 'ASSIGNED',
    description: 'Reassigned to a different driver',
  },
  {
    from: 'DRIVER_ACCEPTED',
    to: 'ON_HOLD',
    description: 'Held after the driver accepted',
  },
  { from: 'DRIVER_ACCEPTED', to: 'CANCELLED', description: 'Cancelled before departure' },
  {
    from: 'EN_ROUTE_TO_PICKUP',
    to: 'AT_PICKUP',
    description: 'The driver arrives at the pickup',
  },
  { from: 'EN_ROUTE_TO_PICKUP', to: 'FAILED', description: 'Could not reach the pickup' },
  {
    from: 'EN_ROUTE_TO_PICKUP',
    to: 'CANCELLED',
    description: 'Cancelled while en route',
  },
  { from: 'AT_PICKUP', to: 'PICKED_UP', description: 'The goods are collected' },
  { from: 'AT_PICKUP', to: 'FAILED', description: 'Nothing available to collect' },
  { from: 'AT_PICKUP', to: 'CANCELLED', description: 'Cancelled at the pickup' },
  { from: 'PICKED_UP', to: 'IN_TRANSIT', description: 'On the road to the delivery' },
  { from: 'PICKED_UP', to: 'FAILED', description: 'Failed after collection' },
  {
    from: 'IN_TRANSIT',
    to: 'AT_DELIVERY',
    description: 'The driver arrives at the delivery',
  },
  { from: 'IN_TRANSIT', to: 'FAILED', description: 'Failed in transit' },
  {
    from: 'IN_TRANSIT',
    to: 'ON_HOLD',
    description: 'Held in transit — an exception on the road',
  },
  { from: 'AT_DELIVERY', to: 'DELIVERED', description: 'The goods are handed over' },
  { from: 'AT_DELIVERY', to: 'FAILED', description: 'Delivery refused or impossible' },

  // Closing
  { from: 'DELIVERED', to: 'POD_RECEIVED', description: 'Proof of delivery is captured' },
  { from: 'POD_RECEIVED', to: 'COMPLETED', description: 'The job is complete' },

  // Returning from a hold
  { from: 'ON_HOLD', to: 'REVIEW', description: 'Resumed at review' },
  { from: 'ON_HOLD', to: 'QUOTED', description: 'Resumed at quoted' },
  { from: 'ON_HOLD', to: 'APPROVED', description: 'Resumed at approved' },
  { from: 'ON_HOLD', to: 'SCHEDULED', description: 'Resumed on the schedule' },
  { from: 'ON_HOLD', to: 'ASSIGNED', description: 'Resumed as assigned' },
  { from: 'ON_HOLD', to: 'IN_TRANSIT', description: 'Resumed in transit' },
  { from: 'ON_HOLD', to: 'CANCELLED', description: 'Cancelled while on hold' },

  // Retry or close off a failure
  { from: 'FAILED', to: 'SCHEDULED', description: 'Rescheduled after a failure' },
  { from: 'FAILED', to: 'CANCELLED', description: 'Abandoned after a failure' },
  {
    from: 'FAILED',
    to: 'COMPLETED',
    description: 'Closed off — work done, outcome recorded',
  },
];

const TRANSITION_KEYS = new Set(JOB_TRANSITIONS.map((t) => `${t.from}->${t.to}`));

export function isTransitionAllowed(from: JobStatus, to: JobStatus): boolean {
  return TRANSITION_KEYS.has(`${from}->${to}`);
}

export function allowedTransitionsFrom(from: JobStatus): readonly Transition[] {
  return JOB_TRANSITIONS.filter((t) => t.from === from);
}

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export function occupiesResources(status: JobStatus): boolean {
  return RESOURCE_OCCUPYING_STATUSES.includes(status);
}

/** What a transition additionally requires before it may proceed. */
export interface TransitionContext {
  readonly vehicleId?: string | null;
  readonly driverId?: string | null;
  readonly actualMilesTenths?: number | null;
  readonly cancellationReason?: string | null;
  readonly hasProofOfDelivery?: boolean;
}

export const TRANSITION_ERRORS = {
  NOT_ALLOWED: 'job/transition-not-allowed',
  NEEDS_ASSIGNMENT: 'job/needs-vehicle-and-driver',
  NEEDS_DRIVER: 'job/needs-driver',
  NEEDS_MILEAGE: 'job/needs-actual-mileage',
  NEEDS_REASON: 'job/needs-cancellation-reason',
  NEEDS_POD: 'job/needs-proof-of-delivery',
} as const;

/**
 * Validate a proposed status change.
 *
 * Mirrors the guards in the database trigger. Returning a Result rather than
 * throwing lets the interface show the reason plainly — a partner needs to know
 * *why* a job cannot be completed, not merely that it cannot.
 */
export function validateTransition(
  from: JobStatus,
  to: JobStatus,
  context: TransitionContext = {},
): Result<Transition> {
  const transition = JOB_TRANSITIONS.find((t) => t.from === from && t.to === to);

  if (!transition) {
    return err(
      domainError(
        TRANSITION_ERRORS.NOT_ALLOWED,
        `A job cannot move from ${from} to ${to}.`,
        { from, to, allowed: allowedTransitionsFrom(from).map((t) => t.to) },
      ),
    );
  }

  if (to === 'ASSIGNED' && (!context.vehicleId || !context.driverId)) {
    return err(
      domainError(
        TRANSITION_ERRORS.NEEDS_ASSIGNMENT,
        'A job cannot be ASSIGNED without both a vehicle and a driver.',
      ),
    );
  }

  if (to === 'DRIVER_ACCEPTED' && !context.driverId) {
    return err(
      domainError(
        TRANSITION_ERRORS.NEEDS_DRIVER,
        'A job cannot be DRIVER_ACCEPTED without an assigned driver.',
      ),
    );
  }

  if (
    to === 'COMPLETED' &&
    from !== 'FAILED' &&
    (context.actualMilesTenths === null || context.actualMilesTenths === undefined)
  ) {
    return err(
      domainError(
        TRANSITION_ERRORS.NEEDS_MILEAGE,
        'A job cannot be COMPLETED before actual mileage is recorded.',
      ),
    );
  }

  if (to === 'POD_RECEIVED' && context.hasProofOfDelivery === false) {
    return err(
      domainError(
        TRANSITION_ERRORS.NEEDS_POD,
        'POD_RECEIVED requires a proof of delivery document on the job.',
      ),
    );
  }

  if (to === 'CANCELLED' && !context.cancellationReason?.trim()) {
    return err(
      domainError(TRANSITION_ERRORS.NEEDS_REASON, 'Cancelling a job requires a reason.'),
    );
  }

  return ok(transition);
}
