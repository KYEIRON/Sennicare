import { describe, expect, it } from 'vitest';
import {
  averageContributionPerJob,
  calculateProfitability,
  contributionMargin,
  contributionPerMile,
  emptyMileageShare,
  jobsBlockingProfitability,
  lossMakingJobs,
  profitabilityByCustomer,
  profitabilityByVehicle,
  type ProfitabilityJob,
} from '@/services/finance/profitability';
import { formatCalculation, formatCents } from '@/lib/format';

function job(overrides: Partial<ProfitabilityJob> = {}): ProfitabilityJob {
  return {
    id: crypto.randomUUID(),
    job_number: 'TEST-1',
    status: 'COMPLETED',
    customer_id: 'customer-a',
    vehicle_id: 'vehicle-a',
    completed_at: '2026-09-16T14:00:00Z',
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

describe('profitability across jobs', () => {
  it('sums revenue, cost and contribution', () => {
    const result = calculateProfitability([job(), job()]);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.value.jobCount).toBe(2);
      expect(result.value.revenue).toBe(60_000);
      expect(result.value.totalCost).toBe(48_000);
      expect(result.value.contribution).toBe(12_000);
    }
  });

  it('counts only COMPLETED jobs — work in progress still has costs arriving', () => {
    const result = calculateProfitability([
      job(),
      job({ status: 'IN_TRANSIT' }),
      job({ status: 'CANCELLED' }),
    ]);
    if (result.status === 'OK') expect(result.value.jobCount).toBe(1);
  });

  it('is a real zero across no completed jobs', () => {
    const result = calculateProfitability([job({ status: 'SCHEDULED' })]);
    expect(result).toMatchObject({ status: 'OK' });
    if (result.status === 'OK') expect(result.value.jobCount).toBe(0);
  });

  it('is DATA_INCOMPLETE if ANY job is missing a cost, naming that job', () => {
    const result = calculateProfitability([
      job({ job_number: 'BJ-1' }),
      job({ job_number: 'BJ-2', fuel_cost_actual_cents: null }),
    ]);

    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['BJ-2: fuel_cost']);
    }
  });

  it('does not present the complete jobs as though they were the whole', () => {
    const result = calculateProfitability([job(), job({ fuel_cost_actual_cents: null })]);
    expect(JSON.stringify(result)).not.toContain('"contribution"');
  });

  it('is DATA_INCOMPLETE when a completed job has no mileage', () => {
    const result = calculateProfitability([
      job({ job_number: 'NO-MILES', actual_miles_tenths: null }),
    ]);
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toContain('NO-MILES: actual_miles');
    }
  });
});

describe('derived measures', () => {
  const result = calculateProfitability([job(), job()]);

  it('computes average contribution per job', () => {
    expect(averageContributionPerJob(result)).toEqual({ status: 'OK', value: 6_000 });
  });

  it('computes contribution per mile', () => {
    // $120 across 49.4 miles = $2.43/mi
    expect(contributionPerMile(result)).toEqual({ status: 'OK', value: 243 });
  });

  it('computes margin', () => {
    expect(contributionMargin(result)).toEqual({ status: 'OK', value: 2000 });
  });

  it('computes empty mileage share', () => {
    expect(emptyMileageShare(result)).toEqual({ status: 'OK', value: 2308 });
  });

  it('refuses an average with no completed jobs', () => {
    const empty = calculateProfitability([]);
    expect(averageContributionPerJob(empty).status).toBe('NOT_CALCULABLE');
  });

  it('propagates incompleteness through every derived measure', () => {
    const incomplete = calculateProfitability([job({ fuel_cost_actual_cents: null })]);
    for (const measure of [
      averageContributionPerJob,
      contributionPerMile,
      contributionMargin,
      emptyMileageShare,
    ]) {
      expect(measure(incomplete).status).toBe('DATA_INCOMPLETE');
    }
  });
});

describe('grouping', () => {
  it('groups by customer', () => {
    const groups = profitabilityByCustomer([
      job({ customer_id: 'a' }),
      job({ customer_id: 'a' }),
      job({ customer_id: 'b' }),
    ]);

    expect(groups).toHaveLength(2);
    const first = groups.find((g) => g.key === 'a')!;
    if (first.result.status === 'OK') expect(first.result.value.jobCount).toBe(2);
  });

  it('groups by vehicle and skips jobs with none assigned', () => {
    const groups = profitabilityByVehicle([
      job({ vehicle_id: 'van-1' }),
      job({ vehicle_id: null }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('records the most recent completed job in a group', () => {
    const groups = profitabilityByCustomer([
      job({ customer_id: 'a', completed_at: '2026-09-01T10:00:00Z' }),
      job({ customer_id: 'a', completed_at: '2026-09-20T10:00:00Z' }),
    ]);
    expect(groups[0]!.lastJobAt).toBe('2026-09-20T10:00:00Z');
  });

  it('marks a customer incomplete when one of THEIR jobs is', () => {
    const groups = profitabilityByCustomer([
      job({ customer_id: 'a' }),
      job({ customer_id: 'b', job_number: 'GAP', toll_cost_actual_cents: null }),
    ]);

    expect(groups.find((g) => g.key === 'a')!.result.status).toBe('OK');
    expect(groups.find((g) => g.key === 'b')!.result.status).toBe('DATA_INCOMPLETE');
  });
});

describe('loss-making jobs', () => {
  it('lists jobs that genuinely lost money, worst first', () => {
    const losses = lossMakingJobs([
      job({ job_number: 'OK' }),
      job({ job_number: 'SMALL-LOSS', won_price_cents: 22_000 }),
      job({ job_number: 'BIG-LOSS', won_price_cents: 10_000 }),
    ]);

    expect(losses.map((l) => l.job.job_number)).toEqual(['BIG-LOSS', 'SMALL-LOSS']);
    expect(losses[0]!.contribution).toBe(-14_000);
  });

  it('NEVER includes a job whose costs are merely unknown', () => {
    // An unknown result is not a bad result, and must not be reported as one.
    const losses = lossMakingJobs([
      job({ job_number: 'UNKNOWN', fuel_cost_actual_cents: null }),
    ]);
    expect(losses).toEqual([]);
  });

  it('renders a loss as a negative figure', () => {
    const losses = lossMakingJobs([job({ won_price_cents: 15_000 })]);
    expect(formatCents(losses[0]!.contribution)).toBe('-$90.00');
  });
});

describe('what is blocking profitability', () => {
  it('lists completed jobs whose figures cannot be stated, and why', () => {
    const blocking = jobsBlockingProfitability([
      job({ job_number: 'FINE' }),
      job({ job_number: 'NO-FUEL', fuel_cost_actual_cents: null }),
      job({ job_number: 'NO-MILES', actual_miles_tenths: null }),
      job({ job_number: 'RUNNING', status: 'IN_TRANSIT', fuel_cost_actual_cents: null }),
    ]);

    expect(blocking.map((b) => b.job.job_number)).toEqual(['NO-FUEL', 'NO-MILES']);
    expect(blocking[0]!.missing).toEqual(['fuel_cost']);
    expect(blocking[1]!.missing).toContain('actual_miles');
  });

  it('shows DATA INCOMPLETE at the display edge', () => {
    const result = calculateProfitability([job({ fuel_cost_actual_cents: null })]);
    const shown = formatCalculation(result, (v) => formatCents(v.contribution));
    expect(shown.text).toBe('DATA INCOMPLETE');
  });
});
