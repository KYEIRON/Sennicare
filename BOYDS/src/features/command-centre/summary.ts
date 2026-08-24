/**
 * Command Centre figures.
 *
 * Pure: takes job rows, returns Calculations. No database, no framework, so the
 * arithmetic behind BOYD'S headline numbers is unit-testable without either.
 *
 * The governing rule is that a KPI never shows a number BOYD'S cannot stand
 * behind. Revenue is a fact — it is what customers agreed to pay. Contribution
 * is not a fact until every cost is recorded, so it reports DATA INCOMPLETE and
 * names the jobs responsible.
 */

import {
  cents,
  milesTenths,
  type Bps,
  type Cents,
  type MilesTenths,
} from '@/types/branded';
import {
  calcIncomplete,
  calcOk,
  combineCalculations,
  type Calculation,
} from '@/lib/calculation';
import { addCents } from '@/lib/money';
import { addMiles, emptyMileageBps } from '@/lib/distance';
import {
  calculateContribution,
  costInputsFromRow,
  type CostBasis,
  type JobFinancialRow,
} from '@/services/finance/job-costs';
import type { JobStatus } from '@/types/operations';

/**
 * The subset of a job row these figures need.
 *
 * The financial columns come from the domain; this adds only the operational
 * status the Command Centre groups by.
 */
export interface SummaryJob extends JobFinancialRow {
  readonly status: JobStatus;
}

/**
 * Revenue: the sum of won prices.
 *
 * A job with no agreed price contributes nothing to revenue and is reported as
 * an incomplete input, because "no price recorded" is not "free".
 */
export function totalRevenue(jobs: readonly SummaryJob[]): Calculation<Cents> {
  const parts = jobs.map((job) =>
    job.won_price_cents === null
      ? calcIncomplete<Cents>([`${job.job_number}: won_price`])
      : calcOk(cents(job.won_price_cents)),
  );

  return combineCalculations(parts, (values) => addCents(...values));
}

/**
 * Contribution across a set of jobs.
 *
 * If any job is missing a cost, the total is DATA INCOMPLETE and names which
 * job and which cost. A total assembled from partly-unknown parts is not a
 * total, and BOYD'S will not present it as one.
 */
export function totalContribution(
  jobs: readonly SummaryJob[],
  basis: CostBasis = 'ACTUAL',
): Calculation<Cents> {
  const parts = jobs.map((job) => {
    const result = calculateContribution(costInputsFromRow(job), basis);

    if (result.status === 'DATA_INCOMPLETE') {
      return calcIncomplete<Cents>(
        result.missing.map((field) => `${job.job_number}: ${field}`),
      );
    }
    if (result.status !== 'OK') return result as Calculation<Cents>;

    return calcOk(result.value.contribution, result.usedEstimates);
  });

  return combineCalculations(parts, (values) => addCents(...values));
}

export function totalCostAcrossJobs(
  jobs: readonly SummaryJob[],
  basis: CostBasis = 'ACTUAL',
): Calculation<Cents> {
  const revenue = totalRevenue(jobs);
  const contribution = totalContribution(jobs, basis);

  return combineCalculations([revenue, contribution], ([r, c]) =>
    cents((r ?? 0) - (c ?? 0)),
  );
}

/** Total miles driven on these jobs. */
export function totalMiles(jobs: readonly SummaryJob[]): Calculation<MilesTenths> {
  const parts = jobs.map((job) =>
    job.actual_miles_tenths === null
      ? calcIncomplete<MilesTenths>([`${job.job_number}: actual_miles`])
      : calcOk(milesTenths(job.actual_miles_tenths)),
  );

  return combineCalculations(parts, (values) => addMiles(...values));
}

export function totalEmptyMiles(jobs: readonly SummaryJob[]): Calculation<MilesTenths> {
  const parts = jobs.map((job) =>
    job.empty_miles_tenths === null
      ? calcIncomplete<MilesTenths>([`${job.job_number}: empty_miles`])
      : calcOk(milesTenths(job.empty_miles_tenths)),
  );

  return combineCalculations(parts, (values) => addMiles(...values));
}

/** Empty mileage as a share of total miles — a strategic BOYD'S metric. */
export function emptyMileagePercentage(jobs: readonly SummaryJob[]): Calculation<Bps> {
  const total = totalMiles(jobs);
  const empty = totalEmptyMiles(jobs);

  if (total.status !== 'OK') return total as Calculation<Bps>;
  if (empty.status !== 'OK') return empty as Calculation<Bps>;

  return emptyMileageBps(empty.value, total.value);
}

/** Jobs currently out on the road. */
export function activeJobs(jobs: readonly SummaryJob[]): readonly SummaryJob[] {
  const live: readonly JobStatus[] = [
    'DRIVER_ACCEPTED',
    'EN_ROUTE_TO_PICKUP',
    'AT_PICKUP',
    'PICKED_UP',
    'IN_TRANSIT',
    'AT_DELIVERY',
  ];
  return jobs.filter((job) => live.includes(job.status));
}

/**
 * Jobs that need a partner's attention.
 *
 * Deliberately conservative: this list drives what someone does next, so it
 * contains only things genuinely waiting on a decision or an action.
 */
export function needsAttention(jobs: readonly SummaryJob[]): readonly SummaryJob[] {
  const waiting: readonly JobStatus[] = ['REQUESTED', 'REVIEW', 'ON_HOLD', 'FAILED'];
  return jobs.filter((job) => waiting.includes(job.status));
}

/** Completed jobs whose costs are not fully recorded. */
export function jobsWithMissingCosts(
  jobs: readonly SummaryJob[],
): readonly { job: SummaryJob; missing: readonly string[] }[] {
  return jobs
    .filter((job) => job.status === 'COMPLETED')
    .map((job) => {
      const result = calculateContribution(costInputsFromRow(job), 'ACTUAL');
      return {
        job,
        missing: result.status === 'DATA_INCOMPLETE' ? result.missing : [],
      };
    })
    .filter((entry) => entry.missing.length > 0);
}
