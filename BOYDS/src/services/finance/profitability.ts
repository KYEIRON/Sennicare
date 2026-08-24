/**
 * Customer, vehicle and period profitability.
 *
 * The rule that governs everything here: if ANY constituent job is incomplete,
 * the aggregate is incomplete and names the jobs responsible. A total assembled
 * from partly-unknown parts is not a total, and presenting it as one is how a
 * business talks itself into unprofitable work.
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
  calcNotCalculable,
  calcOk,
  combineCalculations,
  type Calculation,
} from '@/lib/calculation';
import { addCents, centsPerMile, ratioBps } from '@/lib/money';
import { addMiles, emptyMileageBps } from '@/lib/distance';
import {
  calculateContribution,
  costInputsFromRow,
  parseStoredMiles,
  type CostBasis,
  type JobFinancialRow,
} from './job-costs';

export interface ProfitabilityJob extends JobFinancialRow {
  readonly customer_id: string;
  readonly vehicle_id: string | null;
  readonly completed_at: string | null;
}

export interface ProfitabilityResult {
  readonly jobCount: number;
  readonly revenue: Cents;
  readonly totalCost: Cents;
  readonly contribution: Cents;
  readonly totalMiles: MilesTenths;
  readonly loadedMiles: MilesTenths;
  readonly emptyMiles: MilesTenths;
}

/**
 * Profitability across a set of jobs.
 *
 * Only COMPLETED jobs count. Work still in progress has costs still arriving,
 * and including it would make every figure a moving target.
 */
export function calculateProfitability(
  jobs: readonly ProfitabilityJob[],
  basis: CostBasis = 'ACTUAL',
): Calculation<ProfitabilityResult> {
  const completed = jobs.filter((job) => job.status === 'COMPLETED');

  if (completed.length === 0) {
    return calcOk({
      jobCount: 0,
      revenue: cents(0),
      totalCost: cents(0),
      contribution: cents(0),
      totalMiles: milesTenths(0),
      loadedMiles: milesTenths(0),
      emptyMiles: milesTenths(0),
    });
  }

  const perJob = completed.map((job) => {
    const contribution = calculateContribution(costInputsFromRow(job), basis);

    if (contribution.status === 'DATA_INCOMPLETE') {
      return calcIncomplete<ProfitabilityResult>(
        contribution.missing.map((field) => `${job.job_number}: ${field}`),
      );
    }
    if (contribution.status !== 'OK') {
      return contribution as Calculation<ProfitabilityResult>;
    }

    const totalMiles = parseStoredMiles(job.actual_miles_tenths);
    if (totalMiles === null) {
      return calcIncomplete<ProfitabilityResult>([`${job.job_number}: actual_miles`]);
    }

    return calcOk<ProfitabilityResult>(
      {
        jobCount: 1,
        revenue: contribution.value.revenue,
        totalCost: contribution.value.totalCost,
        contribution: contribution.value.contribution,
        totalMiles,
        loadedMiles: parseStoredMiles(job.loaded_miles_tenths) ?? milesTenths(0),
        emptyMiles: parseStoredMiles(job.empty_miles_tenths) ?? milesTenths(0),
      },
      contribution.usedEstimates,
    );
  });

  return combineCalculations(perJob, (values) => ({
    jobCount: values.length,
    revenue: addCents(...values.map((v) => v.revenue)),
    totalCost: addCents(...values.map((v) => v.totalCost)),
    contribution: addCents(...values.map((v) => v.contribution)),
    totalMiles: addMiles(...values.map((v) => v.totalMiles)),
    loadedMiles: addMiles(...values.map((v) => v.loadedMiles)),
    emptyMiles: addMiles(...values.map((v) => v.emptyMiles)),
  }));
}

/** Average contribution per completed job. */
export function averageContributionPerJob(
  result: Calculation<ProfitabilityResult>,
): Calculation<Cents> {
  if (result.status !== 'OK') return result as Calculation<Cents>;
  if (result.value.jobCount === 0) {
    return calcNotCalculable('No completed jobs in this period.');
  }

  return calcOk(
    cents(Math.round(result.value.contribution / result.value.jobCount)),
    result.usedEstimates,
  );
}

export function contributionPerMile(
  result: Calculation<ProfitabilityResult>,
): Calculation<Cents> {
  if (result.status !== 'OK') return result as Calculation<Cents>;

  const perMile = centsPerMile(result.value.contribution, result.value.totalMiles);
  return perMile.status === 'OK' ? calcOk(perMile.value, result.usedEstimates) : perMile;
}

export function contributionMargin(
  result: Calculation<ProfitabilityResult>,
): Calculation<Bps> {
  if (result.status !== 'OK') return result as Calculation<Bps>;

  const margin = ratioBps(result.value.contribution, result.value.revenue);
  return margin.status === 'OK' ? calcOk(margin.value, result.usedEstimates) : margin;
}

export function emptyMileageShare(
  result: Calculation<ProfitabilityResult>,
): Calculation<Bps> {
  if (result.status !== 'OK') return result as Calculation<Bps>;
  return emptyMileageBps(result.value.emptyMiles, result.value.totalMiles);
}

// --- Grouping ----------------------------------------------------------------

export interface GroupedProfitability<K extends string> {
  readonly key: K;
  readonly result: Calculation<ProfitabilityResult>;
  readonly lastJobAt: string | null;
  readonly jobNumbers: readonly string[];
}

function group<K extends string>(
  jobs: readonly ProfitabilityJob[],
  keyOf: (job: ProfitabilityJob) => K | null,
  basis: CostBasis,
): readonly GroupedProfitability<K>[] {
  const buckets = new Map<K, ProfitabilityJob[]>();

  for (const job of jobs) {
    const key = keyOf(job);
    if (key === null) continue;

    const bucket = buckets.get(key);
    if (bucket) bucket.push(job);
    else buckets.set(key, [job]);
  }

  return [...buckets.entries()].map(([key, groupedJobs]) => {
    const completedAt = groupedJobs
      .map((job) => job.completed_at)
      .filter((value): value is string => value !== null)
      .sort();

    return {
      key,
      result: calculateProfitability(groupedJobs, basis),
      lastJobAt: completedAt.at(-1) ?? null,
      jobNumbers: groupedJobs.map((job) => job.job_number),
    };
  });
}

/** Profitability per customer. Incomplete data names the customer's own jobs. */
export function profitabilityByCustomer(
  jobs: readonly ProfitabilityJob[],
  basis: CostBasis = 'ACTUAL',
): readonly GroupedProfitability<string>[] {
  return group(jobs, (job) => job.customer_id, basis);
}

/** Profitability per vehicle. */
export function profitabilityByVehicle(
  jobs: readonly ProfitabilityJob[],
  basis: CostBasis = 'ACTUAL',
): readonly GroupedProfitability<string>[] {
  return group(jobs, (job) => job.vehicle_id, basis);
}

/**
 * The jobs that lost money.
 *
 * Kept deliberately simple and separate: this is the list a partner most needs
 * to see, and it must never be diluted by jobs whose costs are merely unknown.
 * An unknown result is not a good result.
 */
export function lossMakingJobs(
  jobs: readonly ProfitabilityJob[],
  basis: CostBasis = 'ACTUAL',
): readonly { job: ProfitabilityJob; contribution: Cents }[] {
  return jobs
    .filter((job) => job.status === 'COMPLETED')
    .map((job) => ({
      job,
      result: calculateContribution(costInputsFromRow(job), basis),
    }))
    .filter(
      (
        entry,
      ): entry is typeof entry & {
        result: { status: 'OK'; value: { contribution: Cents } };
      } => entry.result.status === 'OK' && entry.result.value.contribution < 0,
    )
    .map((entry) => ({ job: entry.job, contribution: entry.result.value.contribution }))
    .sort((a, b) => a.contribution - b.contribution);
}

/** Completed jobs whose profitability cannot be stated, and why. */
export function jobsBlockingProfitability(
  jobs: readonly ProfitabilityJob[],
  basis: CostBasis = 'ACTUAL',
): readonly { job: ProfitabilityJob; missing: readonly string[] }[] {
  return jobs
    .filter((job) => job.status === 'COMPLETED')
    .map((job) => {
      const result = calculateContribution(costInputsFromRow(job), basis);
      const missing = result.status === 'DATA_INCOMPLETE' ? result.missing : [];
      const noMileage = job.actual_miles_tenths === null ? ['actual_miles'] : [];
      return { job, missing: [...missing, ...noMileage] };
    })
    .filter((entry) => entry.missing.length > 0);
}
