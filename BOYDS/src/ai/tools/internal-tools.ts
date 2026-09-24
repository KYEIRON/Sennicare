/**
 * Tools the INTERNAL assistant may use.
 *
 * Every tool requires a partner. Each runs through the caller's session-bound
 * client, so row level security applies to the AI exactly as it applies to the
 * person asking — the AI cannot see anything Ronald could not see himself.
 *
 * Figures come back through the same Calculation types the rest of BOYD'S uses,
 * so the AI is handed DATA_INCOMPLETE rather than a plausible number, and can
 * only report what it was actually given.
 */

import 'server-only';

import { z } from 'zod';
import {
  listCustomers,
  listJobsForProfitability,
  listQuotes,
  listVehicles,
  listInvoices,
  listLeads,
} from '@/database/operations';
import {
  calculateProfitability,
  contributionMargin,
  contributionPerMile,
  emptyMileageShare,
  jobsBlockingProfitability,
  lossMakingJobs,
  profitabilityByCustomer,
  type ProfitabilityJob,
} from '@/services/finance/profitability';
import { formatBps, formatCents, formatMiles } from '@/lib/format';
import { cents } from '@/types/branded';
import type { AiTool, ToolRegistry } from './types';

/** Render a Calculation for the model exactly as the interface would. */
function describe<T>(
  calculation: ReturnType<typeof calculateProfitability> | { status: string },
  format: (value: T) => string,
): string {
  const result = calculation as
    | { status: 'OK'; value: T; usedEstimates?: readonly string[] }
    | { status: 'DATA_INCOMPLETE'; missing: readonly string[] }
    | { status: 'NOT_CALCULABLE'; reason: string }
    | { status: 'NOT_CONFIGURED'; setting: string };

  switch (result.status) {
    case 'OK':
      return (result.usedEstimates?.length ?? 0) > 0
        ? `${format(result.value)} (ESTIMATE — based on estimated ${result.usedEstimates!.join(', ')})`
        : format(result.value);
    case 'DATA_INCOMPLETE':
      return `DATA INCOMPLETE — missing ${result.missing.join(', ')}`;
    case 'NOT_CALCULABLE':
      return `NOT CALCULABLE — ${result.reason}`;
    case 'NOT_CONFIGURED':
      return `NOT CONFIGURED — ${result.setting} has not been decided`;
    default:
      return 'DATA INCOMPLETE';
  }
}

const profitabilityInput = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const getProfitability: AiTool<z.infer<typeof profitabilityInput>> = {
  name: 'get_profitability',
  description:
    "BOYD'S revenue, cost, contribution, margin, miles and empty mileage over a period. Figures may come back as DATA INCOMPLETE — report that exactly, never a number.",
  schema: profitabilityInput,
  minimumRole: 'PARTNER',
  async execute(input, context) {
    const result = await listJobsForProfitability(context.client, {
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {}),
    });
    if (!result.ok) return { error: 'Could not read the job data.' };

    const jobs = result.value as unknown as ProfitabilityJob[];
    const overall = calculateProfitability(jobs);
    const blocking = jobsBlockingProfitability(jobs);

    return {
      period: { from: input.from ?? 'all time', to: input.to ?? 'now' },
      completedJobs: overall.status === 'OK' ? overall.value.jobCount : null,
      revenue: describe(overall, (v: { revenue: number }) =>
        formatCents(cents(v.revenue)),
      ),
      totalCost: describe(overall, (v: { totalCost: number }) =>
        formatCents(cents(v.totalCost)),
      ),
      contribution: describe(overall, (v: { contribution: number }) =>
        formatCents(cents(v.contribution)),
      ),
      contributionPerMile: describe(contributionPerMile(overall), (v: number) =>
        formatCents(cents(v)),
      ),
      margin: describe(contributionMargin(overall), (v: number) => formatBps(v as never)),
      totalMiles: describe(overall, (v: { totalMiles: number }) =>
        formatMiles(v.totalMiles as never),
      ),
      emptyMileage: describe(emptyMileageShare(overall), (v: number) =>
        formatBps(v as never),
      ),
      jobsBlockingTheseFigures: blocking.map((entry) => ({
        job: entry.job.job_number,
        missing: entry.missing,
      })),
    };
  },
};

const emptyInput = z.object({});

const getLossMakingJobs: AiTool<z.infer<typeof emptyInput>> = {
  name: 'get_loss_making_jobs',
  description:
    'Completed jobs with full cost data that lost money, worst first. Jobs whose costs are unknown are NOT included — they are listed separately as blocking.',
  schema: emptyInput,
  minimumRole: 'PARTNER',
  async execute(_input, context) {
    const result = await listJobsForProfitability(context.client);
    if (!result.ok) return { error: 'Could not read the job data.' };

    const jobs = result.value as unknown as ProfitabilityJob[];

    return {
      lossMaking: lossMakingJobs(jobs).map((entry) => ({
        job: entry.job.job_number,
        contribution: formatCents(entry.contribution),
      })),
      notMeasurable: jobsBlockingProfitability(jobs).map((entry) => ({
        job: entry.job.job_number,
        missing: entry.missing,
      })),
      note: 'A job with unknown costs is not a profitable job. It is an unmeasured one.',
    };
  },
};

const getCustomerProfitability: AiTool<z.infer<typeof emptyInput>> = {
  name: 'get_customer_profitability',
  description: 'Revenue and contribution per customer, on completed jobs.',
  schema: emptyInput,
  minimumRole: 'PARTNER',
  async execute(_input, context) {
    const [jobsResult, customersResult] = await Promise.all([
      listJobsForProfitability(context.client),
      listCustomers(context.client),
    ]);
    if (!jobsResult.ok || !customersResult.ok) {
      return { error: 'Could not read the customer data.' };
    }

    const names = new Map(customersResult.value.map((c) => [c.id, c.companyName]));
    const jobs = jobsResult.value as unknown as ProfitabilityJob[];

    return profitabilityByCustomer(jobs).map((group) => ({
      customer: names.get(group.key) ?? 'Unknown',
      jobs: group.result.status === 'OK' ? group.result.value.jobCount : null,
      revenue: describe(group.result, (v: { revenue: number }) =>
        formatCents(cents(v.revenue)),
      ),
      contribution: describe(group.result, (v: { contribution: number }) =>
        formatCents(cents(v.contribution)),
      ),
      lastJob: group.lastJobAt,
    }));
  },
};

const getOpenQuotes: AiTool<z.infer<typeof emptyInput>> = {
  name: 'get_open_quotes',
  description: 'Quotes that have been sent or viewed and are awaiting a decision.',
  schema: emptyInput,
  minimumRole: 'PARTNER',
  async execute(_input, context) {
    const [quotesResult, customersResult] = await Promise.all([
      listQuotes(context.client),
      listCustomers(context.client),
    ]);
    if (!quotesResult.ok) return { error: 'Could not read the quotes.' };

    const names = new Map(
      (customersResult.ok ? customersResult.value : []).map((c) => [c.id, c.companyName]),
    );

    return quotesResult.value
      .filter((quote) => quote.status === 'SENT' || quote.status === 'VIEWED')
      .map((quote) => ({
        quote: quote.quoteNumber,
        customer: names.get(quote.customerId ?? '') ?? 'Unknown',
        price: formatCents(cents(quote.quotedPriceCents)),
        expectedContribution:
          quote.expectedContributionCents === null
            ? 'DATA INCOMPLETE'
            : formatCents(cents(quote.expectedContributionCents)),
        validUntil: quote.validUntil,
      }));
  },
};

const getFollowUps: AiTool<z.infer<typeof emptyInput>> = {
  name: 'get_followups',
  description: 'Leads with a follow-up due, and open leads with no next step set.',
  schema: emptyInput,
  minimumRole: 'PARTNER',
  async execute(_input, context) {
    const result = await listLeads(context.client);
    if (!result.ok) return { error: 'Could not read the leads.' };

    const today = new Date().toISOString().slice(0, 10);
    const open = result.value.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');

    return {
      due: open
        .filter((l) => l.nextFollowupAt !== null && l.nextFollowupAt <= today)
        .map((l) => ({ company: l.companyName, due: l.nextFollowupAt, stage: l.stage })),
      noFollowUpSet: open
        .filter((l) => l.nextFollowupAt === null)
        .map((l) => ({ company: l.companyName, stage: l.stage })),
    };
  },
};

const getOutstandingInvoices: AiTool<z.infer<typeof emptyInput>> = {
  name: 'get_invoice_report',
  description: 'Outstanding and overdue invoices, and what is owed.',
  schema: emptyInput,
  minimumRole: 'PARTNER',
  async execute(_input, context) {
    const [invoicesResult, customersResult] = await Promise.all([
      listInvoices(context.client),
      listCustomers(context.client),
    ]);
    if (!invoicesResult.ok) return { error: 'Could not read the invoices.' };

    const names = new Map(
      (customersResult.ok ? customersResult.value : []).map((c) => [c.id, c.companyName]),
    );
    const today = new Date().toISOString().slice(0, 10);

    return invoicesResult.value
      .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
      .map((invoice) => ({
        invoice: invoice.invoiceNumber,
        customer: names.get(invoice.customerId) ?? 'Unknown',
        owed: formatCents(cents(invoice.totalCents - invoice.amountPaidCents)),
        dueDate: invoice.dueDate,
        overdue: invoice.dueDate !== null && invoice.dueDate < today,
      }));
  },
};

const getVehicleStatus: AiTool<z.infer<typeof emptyInput>> = {
  name: 'get_vehicle_status',
  description:
    "The state of BOYD'S vehicles. There is no live location — no GPS is connected.",
  schema: emptyInput,
  minimumRole: 'PARTNER',
  async execute(_input, context) {
    const result = await listVehicles(context.client);
    if (!result.ok) return { error: 'Could not read the vehicles.' };

    return {
      vehicles: result.value.map((vehicle) => ({
        code: vehicle.vehicleCode,
        status: vehicle.status,
        active: vehicle.active,
      })),
      liveLocation: 'UNAVAILABLE — no maps provider is connected. Do not estimate one.',
    };
  },
};

export const internalTools: ToolRegistry = {
  get_profitability: getProfitability as AiTool<never>,
  get_loss_making_jobs: getLossMakingJobs as AiTool<never>,
  get_customer_profitability: getCustomerProfitability as AiTool<never>,
  get_open_quotes: getOpenQuotes as AiTool<never>,
  get_followups: getFollowUps as AiTool<never>,
  get_invoice_report: getOutstandingInvoices as AiTool<never>,
  get_vehicle_status: getVehicleStatus as AiTool<never>,
};
