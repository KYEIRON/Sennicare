import { describe, expect, it } from 'vitest';
import { createJobSchema } from '@/validation/operations';

/**
 * A job is as many stops as the work actually has.
 *
 * BOYD'S runs multi-drop work — one collection, four deliveries — and entering
 * it as four separate jobs would invent journeys that never happened and split
 * one run's mileage and cost across records that cannot be reconciled.
 */

const BASE = {
  customerId: '00000000-0000-4000-8000-000000000001',
  jobTypeId: '00000000-0000-4000-8000-000000000002',
  priority: 'STANDARD' as const,
};

function stop(
  sequence: number,
  stopType: 'PICKUP' | 'DELIVERY' | 'INTERMEDIATE',
  city: string,
) {
  return {
    sequence,
    stopType,
    addressLine1: `${sequence} Test Street`,
    city,
    state: 'NC',
    zip: '28202',
  };
}

describe('a multi-drop run is one job', () => {
  it('accepts one collection and three deliveries', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [
        stop(1, 'PICKUP', 'Charlotte'),
        stop(2, 'DELIVERY', 'Concord'),
        stop(3, 'DELIVERY', 'Kannapolis'),
        stop(4, 'DELIVERY', 'Salisbury'),
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stops).toHaveLength(4);
  });

  it('accepts two collections before the deliveries', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [
        stop(1, 'PICKUP', 'Charlotte'),
        stop(2, 'PICKUP', 'Matthews'),
        stop(3, 'DELIVERY', 'Concord'),
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a call-in on the way', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [
        stop(1, 'PICKUP', 'Charlotte'),
        stop(2, 'INTERMEDIATE', 'Harrisburg'),
        stop(3, 'DELIVERY', 'Concord'),
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe('a run that could not be driven is refused', () => {
  it('refuses a delivery before its collection', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [stop(1, 'DELIVERY', 'Concord'), stop(2, 'PICKUP', 'Charlotte')],
    });

    expect(result.success).toBe(false);
  });

  it('refuses a collection after the first delivery', () => {
    // The van cannot deliver goods it has not collected yet.
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [
        stop(1, 'PICKUP', 'Charlotte'),
        stop(2, 'DELIVERY', 'Concord'),
        stop(3, 'PICKUP', 'Kannapolis'),
        stop(4, 'DELIVERY', 'Salisbury'),
      ],
    });

    expect(result.success).toBe(false);
  });

  it('refuses a run with no delivery', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [stop(1, 'PICKUP', 'Charlotte'), stop(2, 'PICKUP', 'Matthews')],
    });

    expect(result.success).toBe(false);
  });

  it('refuses a run with no collection', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [stop(1, 'DELIVERY', 'Concord'), stop(2, 'DELIVERY', 'Salisbury')],
    });

    expect(result.success).toBe(false);
  });

  it('refuses a single stop', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [stop(1, 'PICKUP', 'Charlotte')],
    });

    expect(result.success).toBe(false);
  });

  it('refuses two stops claiming the same place in the run', () => {
    const result = createJobSchema.safeParse({
      ...BASE,
      stops: [stop(1, 'PICKUP', 'Charlotte'), stop(1, 'DELIVERY', 'Concord')],
    });

    expect(result.success).toBe(false);
  });
});
