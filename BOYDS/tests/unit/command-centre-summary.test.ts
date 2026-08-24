import { describe, expect, it } from 'vitest';
import {
  activeJobs,
  emptyMileagePercentage,
  jobsWithMissingCosts,
  needsAttention,
  totalContribution,
  totalCostAcrossJobs,
  totalEmptyMiles,
  totalMiles,
  totalRevenue,
  type SummaryJob,
} from '@/features/command-centre/summary';
import type { JobStatus } from '@/types/operations';
import { formatCalculation, formatCents } from '@/lib/format';

function job(overrides: Partial<SummaryJob> = {}): SummaryJob {
  return {
    id: crypto.randomUUID(),
    job_number: 'TEST-1',
    status: 'COMPLETED',
    won_price_cents: 30_000,
    actual_miles_tenths: 247,
    loaded_miles_tenths: 190,
    empty_miles_tenths: 57,
    fuel_cost_estimated_cents: null,
    fuel_cost_actual_cents: 8_000,
    driver_cost_estimated_cents: null,
    driver_cost_actual_cents: 7_000,
    vehicle_cost_estimated_cents: null,
    vehicle_cost_actual_cents: 4_000,
    toll_cost_estimated_cents: null,
    toll_cost_actual_cents: 2_000,
    parking_cost_estimated_cents: null,
    parking_cost_actual_cents: 1_000,
    other_cost_estimated_cents: null,
    other_cost_actual_cents: 2_000,
    ...overrides,
  };
}

describe('revenue', () => {
  it('sums the agreed prices', () => {
    const result = totalRevenue([job(), job({ won_price_cents: 45_000 })]);
    expect(result).toEqual({ status: 'OK', value: 75_000 });
  });

  it('is zero across no jobs — a real answer, not a gap', () => {
    expect(totalRevenue([])).toEqual({ status: 'OK', value: 0 });
  });

  it('reports a job with no agreed price rather than counting it as free', () => {
    const result = totalRevenue([
      job(),
      job({ job_number: 'NO-PRICE', won_price_cents: null }),
    ]);
    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['NO-PRICE: won_price']);
    }
  });
});

describe('contribution', () => {
  it('sums contribution across complete jobs', () => {
    // Each job: $300 revenue less $240 costs = $60.
    expect(totalContribution([job(), job()])).toEqual({ status: 'OK', value: 12_000 });
  });

  it('refuses a total when ANY job is missing a cost', () => {
    const result = totalContribution([
      job(),
      job({ job_number: 'MISSING-FUEL', fuel_cost_actual_cents: null }),
    ]);

    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['MISSING-FUEL: fuel_cost']);
    }
  });

  it('names the job AND the cost, so a partner knows what to go and record', () => {
    const result = totalContribution([
      job({ job_number: 'BJ-1', fuel_cost_actual_cents: null }),
      job({ job_number: 'BJ-2', toll_cost_actual_cents: null }),
    ]);

    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['BJ-1: fuel_cost', 'BJ-2: toll_cost']);
    }
  });

  it('shows DATA INCOMPLETE on the dashboard rather than a plausible total', () => {
    const result = totalContribution([job(), job({ won_price_cents: null })]);
    const shown = formatCalculation(result, formatCents);
    expect(shown.text).toBe('DATA INCOMPLETE');
  });

  it('does not present the known part as though it were the whole', () => {
    const result = totalContribution([
      job(),
      job({ job_number: 'X', fuel_cost_actual_cents: null }),
    ]);
    // $60 from the complete job would look entirely plausible on a dashboard.
    expect(JSON.stringify(result)).not.toContain('6000');
  });

  it('reports a negative total when the work lost money', () => {
    const result = totalContribution([job({ won_price_cents: 10_000 })]);
    expect(result).toEqual({ status: 'OK', value: -14_000 });
  });
});

describe('total cost', () => {
  it('is revenue less contribution', () => {
    expect(totalCostAcrossJobs([job(), job()])).toEqual({ status: 'OK', value: 48_000 });
  });

  it('is incomplete when contribution is', () => {
    expect(totalCostAcrossJobs([job({ fuel_cost_actual_cents: null })]).status).toBe(
      'DATA_INCOMPLETE',
    );
  });
});

describe('mileage', () => {
  it('sums actual miles', () => {
    expect(totalMiles([job(), job()])).toEqual({ status: 'OK', value: 494 });
  });

  it('sums empty miles', () => {
    expect(totalEmptyMiles([job(), job()])).toEqual({ status: 'OK', value: 114 });
  });

  it('computes empty mileage percentage', () => {
    // 11.4 empty of 49.4 total = 23.08%
    expect(emptyMileagePercentage([job(), job()])).toEqual({ status: 'OK', value: 2308 });
  });

  it('refuses a percentage when mileage is unrecorded', () => {
    const result = emptyMileagePercentage([job({ empty_miles_tenths: null })]);
    expect(result.status).toBe('DATA_INCOMPLETE');
  });

  it('refuses a percentage across zero miles rather than showing 0%', () => {
    const result = emptyMileagePercentage([
      job({ actual_miles_tenths: 0, loaded_miles_tenths: 0, empty_miles_tenths: 0 }),
    ]);
    expect(result.status).toBe('NOT_CALCULABLE');
  });
});

describe('operational lists', () => {
  it('counts only jobs actually out on the road as active', () => {
    const live: JobStatus[] = ['EN_ROUTE_TO_PICKUP', 'IN_TRANSIT', 'AT_DELIVERY'];
    const notLive: JobStatus[] = ['SCHEDULED', 'ASSIGNED', 'COMPLETED', 'CANCELLED'];

    const jobs = [...live, ...notLive].map((status) => job({ status }));
    expect(activeJobs(jobs)).toHaveLength(live.length);
  });

  it('surfaces jobs waiting on a decision', () => {
    const waiting: JobStatus[] = ['REQUESTED', 'REVIEW', 'ON_HOLD', 'FAILED'];
    const jobs = [...waiting, 'COMPLETED' as JobStatus].map((status) => job({ status }));
    expect(needsAttention(jobs)).toHaveLength(waiting.length);
  });

  it('lists completed jobs whose costs are not fully recorded', () => {
    const jobs = [
      job({ job_number: 'DONE-OK' }),
      job({ job_number: 'DONE-GAP', fuel_cost_actual_cents: null }),
      job({
        job_number: 'STILL-RUNNING',
        status: 'IN_TRANSIT',
        fuel_cost_actual_cents: null,
      }),
    ];

    const flagged = jobsWithMissingCosts(jobs);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.job.job_number).toBe('DONE-GAP');
    expect(flagged[0]!.missing).toEqual(['fuel_cost']);
  });
});
