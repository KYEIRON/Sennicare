import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOB_WINDOW_MINUTES,
  canAssign,
  findConflicts,
  isDriverAssignable,
  isVehicleAssignable,
  jobWindow,
  parseTimeToMinutes,
  windowsOverlap,
  type ScheduledJob,
} from '@/services/dispatch/conflicts';

const VEHICLE = {
  id: 'v1',
  vehicleCode: 'TEST-1',
  status: 'AVAILABLE',
  active: true,
} as const;
const DRIVER = {
  id: 'd1',
  status: 'ACTIVE',
  availability: 'AVAILABLE',
  active: true,
} as const;

function existingJob(overrides: Partial<ScheduledJob> = {}): ScheduledJob {
  return {
    id: 'existing-1',
    jobNumber: 'TEST-EXISTING',
    status: 'ASSIGNED',
    vehicleId: 'v1',
    driverId: 'd1',
    scheduledDate: '2026-09-15',
    scheduledTime: '09:00',
    windowEnd: '11:00',
    ...overrides,
  };
}

const PROPOSAL = {
  jobId: 'new-1',
  vehicleId: 'v1',
  driverId: 'd1',
  scheduledDate: '2026-09-15',
  scheduledTime: '10:00',
  windowEnd: '12:00',
};

describe('time windows', () => {
  it('parses times', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('14:00:00')).toBe(840);
  });

  it('rejects malformed or impossible times', () => {
    for (const bad of ['', '9:30', '24:00', '12:60', 'noon']) {
      expect(parseTimeToMinutes(bad)).toBeNull();
    }
  });

  it('applies a default block when no window end is given', () => {
    const window = jobWindow('09:00', null);
    expect(window).toEqual({
      startMinutes: 540,
      endMinutes: 540 + DEFAULT_JOB_WINDOW_MINUTES,
    });
  });

  it('ignores a window end that is not after the start', () => {
    expect(jobWindow('09:00', '08:00')?.endMinutes).toBe(
      540 + DEFAULT_JOB_WINDOW_MINUTES,
    );
  });

  it('treats windows as half-open, so back-to-back jobs do not conflict', () => {
    const morning = { startMinutes: 540, endMinutes: 660 };
    const midday = { startMinutes: 660, endMinutes: 780 };
    expect(windowsOverlap(morning, midday)).toBe(false);
    expect(windowsOverlap(morning, { startMinutes: 659, endMinutes: 780 })).toBe(true);
  });
});

describe('double booking is prevented', () => {
  it('flags a vehicle already committed at that time', () => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [existingJob({ driverId: 'other' })],
      vehicle: VEHICLE,
      driver: DRIVER,
    });
    expect(conflicts.map((c) => c.type)).toContain('VEHICLE_DOUBLE_BOOKED');
    expect(canAssign(conflicts)).toBe(false);
  });

  it('flags a driver already committed at that time', () => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [existingJob({ vehicleId: 'other' })],
      vehicle: VEHICLE,
      driver: DRIVER,
    });
    expect(conflicts.map((c) => c.type)).toContain('DRIVER_DOUBLE_BOOKED');
  });

  it('flags BOTH when the same van and driver are committed', () => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [existingJob()],
      vehicle: VEHICLE,
      driver: DRIVER,
    });
    expect(conflicts.map((c) => c.type)).toEqual(
      expect.arrayContaining(['VEHICLE_DOUBLE_BOOKED', 'DRIVER_DOUBLE_BOOKED']),
    );
  });

  it('names the job that is in the way', () => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [existingJob()],
      vehicle: VEHICLE,
      driver: DRIVER,
    });
    expect(conflicts[0]?.conflictingJobNumber).toBe('TEST-EXISTING');
  });

  it('allows a non-overlapping job on the same day', () => {
    const conflicts = findConflicts(
      { ...PROPOSAL, scheduledTime: '13:00', windowEnd: '15:00' },
      { existingJobs: [existingJob()], vehicle: VEHICLE, driver: DRIVER },
    );
    expect(canAssign(conflicts)).toBe(true);
  });

  it('allows the same time on a different day', () => {
    const conflicts = findConflicts(
      { ...PROPOSAL, scheduledDate: '2026-09-16' },
      { existingJobs: [existingJob()], vehicle: VEHICLE, driver: DRIVER },
    );
    expect(canAssign(conflicts)).toBe(true);
  });

  it('does not conflict a job with itself when rescheduling', () => {
    const conflicts = findConflicts(
      { ...PROPOSAL, jobId: 'existing-1' },
      { existingJobs: [existingJob()], vehicle: VEHICLE, driver: DRIVER },
    );
    expect(canAssign(conflicts)).toBe(true);
  });
});

describe('closed jobs release their resources', () => {
  it.each([
    'COMPLETED',
    'CANCELLED',
    'DECLINED',
    'FAILED',
    'ON_HOLD',
    'SCHEDULED',
  ] as const)('a %s job does not block a new assignment', (status) => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [existingJob({ status })],
      vehicle: VEHICLE,
      driver: DRIVER,
    });
    expect(canAssign(conflicts)).toBe(true);
  });

  it.each([
    'ASSIGNED',
    'DRIVER_ACCEPTED',
    'IN_TRANSIT',
    'AT_DELIVERY',
    'POD_RECEIVED',
  ] as const)('a %s job DOES block a new assignment', (status) => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [existingJob({ status })],
      vehicle: VEHICLE,
      driver: DRIVER,
    });
    expect(canAssign(conflicts)).toBe(false);
  });
});

describe('inactive resources cannot be assigned', () => {
  it.each(['MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'] as const)(
    'refuses a vehicle that is %s',
    (status) => {
      expect(isVehicleAssignable({ ...VEHICLE, status })).toBe(false);
      const conflicts = findConflicts(PROPOSAL, {
        existingJobs: [],
        vehicle: { ...VEHICLE, status },
        driver: DRIVER,
      });
      expect(conflicts.map((c) => c.type)).toContain('VEHICLE_UNAVAILABLE');
    },
  );

  it('refuses an inactive vehicle even when its status looks fine', () => {
    expect(isVehicleAssignable({ ...VEHICLE, active: false })).toBe(false);
  });

  it.each(['INACTIVE', 'SUSPENDED'] as const)('refuses a driver who is %s', (status) => {
    expect(isDriverAssignable({ ...DRIVER, status })).toBe(false);
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [],
      vehicle: VEHICLE,
      driver: { ...DRIVER, status },
    });
    expect(conflicts.map((c) => c.type)).toContain('DRIVER_UNAVAILABLE');
  });

  it('refuses a driver marked unavailable', () => {
    expect(isDriverAssignable({ ...DRIVER, availability: 'UNAVAILABLE' })).toBe(false);
  });

  it('allows a driver who is currently on another job at a different time', () => {
    // ON_JOB is a live-status convenience, not a scheduling rule. Overlap is
    // what actually decides a conflict.
    expect(isDriverAssignable({ ...DRIVER, availability: 'ON_JOB' })).toBe(true);
  });

  it('allows an ASSIGNED vehicle at a non-overlapping time', () => {
    expect(isVehicleAssignable({ ...VEHICLE, status: 'ASSIGNED' })).toBe(true);
  });
});

describe('incomplete assignments', () => {
  it('flags a missing vehicle and driver', () => {
    const conflicts = findConflicts(
      { ...PROPOSAL, vehicleId: null, driverId: null },
      { existingJobs: [] },
    );
    expect(conflicts.map((c) => c.type)).toEqual(
      expect.arrayContaining(['NO_VEHICLE', 'NO_DRIVER']),
    );
  });

  it('flags a job with no schedule', () => {
    const conflicts = findConflicts(
      { ...PROPOSAL, scheduledDate: null, scheduledTime: null },
      { existingJobs: [], vehicle: VEHICLE, driver: DRIVER },
    );
    expect(conflicts.map((c) => c.type)).toContain('NOT_SCHEDULED');
  });

  it('returns EVERY conflict at once, not just the first', () => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [existingJob()],
      vehicle: { ...VEHICLE, status: 'MAINTENANCE' },
      driver: { ...DRIVER, status: 'SUSPENDED' },
    });
    expect(conflicts.length).toBeGreaterThanOrEqual(4);
  });
});

describe('a clean assignment', () => {
  it('reports no conflicts', () => {
    const conflicts = findConflicts(PROPOSAL, {
      existingJobs: [],
      vehicle: VEHICLE,
      driver: DRIVER,
    });
    expect(conflicts).toEqual([]);
    expect(canAssign(conflicts)).toBe(true);
  });

  it('scales past one van — a second vehicle is not blocked by the first', () => {
    const conflicts = findConflicts(
      { ...PROPOSAL, vehicleId: 'v2', driverId: 'd2' },
      {
        existingJobs: [existingJob()],
        vehicle: { ...VEHICLE, id: 'v2' },
        driver: { ...DRIVER, id: 'd2' },
      },
    );
    expect(canAssign(conflicts)).toBe(true);
  });
});
