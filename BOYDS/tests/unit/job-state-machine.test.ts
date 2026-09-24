import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  JOB_TRANSITIONS,
  TRANSITION_ERRORS,
  allowedTransitionsFrom,
  isTerminal,
  isTransitionAllowed,
  occupiesResources,
  validateTransition,
} from '@/services/jobs/state-machine';
import { JOB_STATUSES, type JobStatus } from '@/types/operations';

describe('the happy path runs end to end', () => {
  const lifecycle: JobStatus[] = [
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
  ];

  it.each(lifecycle.slice(0, -1).map((from, i) => [from, lifecycle[i + 1]!]))(
    '%s -> %s is allowed',
    (from, to) => {
      expect(isTransitionAllowed(from, to)).toBe(true);
    },
  );
});

describe('nonsensical transitions are rejected', () => {
  it('rejects COMPLETED -> REQUESTED', () => {
    expect(isTransitionAllowed('COMPLETED', 'REQUESTED')).toBe(false);

    const result = validateTransition('COMPLETED', 'REQUESTED');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(TRANSITION_ERRORS.NOT_ALLOWED);
  });

  it.each([
    ['REQUESTED', 'COMPLETED'],
    ['REQUESTED', 'IN_TRANSIT'],
    ['SCHEDULED', 'DELIVERED'],
    ['DELIVERED', 'AT_PICKUP'],
    ['CANCELLED', 'SCHEDULED'],
    ['DECLINED', 'APPROVED'],
    ['COMPLETED', 'IN_TRANSIT'],
    ['AT_DELIVERY', 'PICKED_UP'],
    ['PICKED_UP', 'REQUESTED'],
  ] as [JobStatus, JobStatus][])('rejects %s -> %s', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(false);
  });

  it('rejects every transition out of a terminal status', () => {
    for (const terminal of ['COMPLETED', 'CANCELLED', 'DECLINED'] as JobStatus[]) {
      expect(isTerminal(terminal)).toBe(true);
      expect(allowedTransitionsFrom(terminal)).toEqual([]);
    }
  });

  it('never allows a status to transition to itself', () => {
    for (const status of JOB_STATUSES) {
      expect(isTransitionAllowed(status, status)).toBe(false);
    }
  });
});

describe('transition guards', () => {
  it('refuses ASSIGNED without both a vehicle and a driver', () => {
    expect(validateTransition('SCHEDULED', 'ASSIGNED', { vehicleId: 'v1' }).ok).toBe(
      false,
    );
    expect(validateTransition('SCHEDULED', 'ASSIGNED', { driverId: 'd1' }).ok).toBe(
      false,
    );
    expect(
      validateTransition('SCHEDULED', 'ASSIGNED', { vehicleId: 'v1', driverId: 'd1' }).ok,
    ).toBe(true);
  });

  it('refuses DRIVER_ACCEPTED without a driver', () => {
    const result = validateTransition('ASSIGNED', 'DRIVER_ACCEPTED', { driverId: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(TRANSITION_ERRORS.NEEDS_DRIVER);
  });

  it('refuses COMPLETED before actual mileage is recorded', () => {
    const without = validateTransition('POD_RECEIVED', 'COMPLETED', {});
    expect(without.ok).toBe(false);
    if (!without.ok) expect(without.error.code).toBe(TRANSITION_ERRORS.NEEDS_MILEAGE);

    expect(
      validateTransition('POD_RECEIVED', 'COMPLETED', { actualMilesTenths: 0 }).ok,
    ).toBe(true);
  });

  it('refuses POD_RECEIVED without proof of delivery', () => {
    const result = validateTransition('DELIVERED', 'POD_RECEIVED', {
      hasProofOfDelivery: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(TRANSITION_ERRORS.NEEDS_POD);
  });

  it('refuses CANCELLED without a reason', () => {
    expect(validateTransition('SCHEDULED', 'CANCELLED', {}).ok).toBe(false);
    expect(
      validateTransition('SCHEDULED', 'CANCELLED', { cancellationReason: '  ' }).ok,
    ).toBe(false);
    expect(
      validateTransition('SCHEDULED', 'CANCELLED', {
        cancellationReason: 'Customer withdrew',
      }).ok,
    ).toBe(true);
  });

  it('tells a partner what IS possible when a transition is refused', () => {
    const result = validateTransition('SCHEDULED', 'DELIVERED');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.allowed).toEqual(
        expect.arrayContaining(['ASSIGNED', 'ON_HOLD', 'CANCELLED']),
      );
    }
  });
});

describe('resource occupancy', () => {
  it('occupies a vehicle and driver only while the job is live', () => {
    for (const status of [
      'ASSIGNED',
      'DRIVER_ACCEPTED',
      'IN_TRANSIT',
      'DELIVERED',
      'POD_RECEIVED',
    ] as JobStatus[]) {
      expect(occupiesResources(status)).toBe(true);
    }
  });

  it('releases them once the job is closed, cancelled or held', () => {
    for (const status of [
      'REQUESTED',
      'SCHEDULED',
      'COMPLETED',
      'CANCELLED',
      'DECLINED',
      'FAILED',
      'ON_HOLD',
    ] as JobStatus[]) {
      expect(occupiesResources(status)).toBe(false);
    }
  });
});

describe('TypeScript and Postgres define the SAME lifecycle', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0009_job_state_machine.sql'),
    'utf8',
  );

  // Read ONLY the insert into job_status_transitions. Parsing the whole file
  // would also match status lists elsewhere in it, such as the initial-status
  // guard, and produce a false mismatch.
  const insertBlock = migration.slice(
    migration.indexOf('insert into job_status_transitions'),
    migration.indexOf('--- Enforcement'),
  );

  const sqlTransitions = [
    ...insertBlock.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)',\s*'/g),
  ].map(([, from, to]) => `${from}->${to}`);

  it('parsed the transition table from the migration', () => {
    expect(sqlTransitions.length).toBeGreaterThan(40);
    expect(new Set(sqlTransitions).size).toBe(sqlTransitions.length);
  });

  it('defines the same number of transitions', () => {
    expect(sqlTransitions.length).toBe(JOB_TRANSITIONS.length);
  });

  it('defines exactly the same transitions', () => {
    const ts = JOB_TRANSITIONS.map((t) => `${t.from}->${t.to}`).sort();
    expect([...sqlTransitions].sort()).toEqual(ts);
  });

  it('references only statuses that exist in the enum', () => {
    for (const transition of JOB_TRANSITIONS) {
      expect(JOB_STATUSES).toContain(transition.from);
      expect(JOB_STATUSES).toContain(transition.to);
    }
  });

  it('leaves no status stranded — every non-initial status is reachable', () => {
    const reachable = new Set(JOB_TRANSITIONS.map((t) => t.to));
    const initial: JobStatus[] = ['REQUESTED', 'REVIEW', 'QUOTED', 'APPROVED'];
    for (const status of JOB_STATUSES) {
      if (initial.includes(status)) continue;
      expect(reachable.has(status)).toBe(true);
    }
  });
});
