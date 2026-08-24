import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import {
  listContracts,
  listCustomers,
  listInvoices,
  listUninvoicedJobs,
} from '@/database/operations';
import { EmptyState, KpiCard, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { formatCents } from '@/lib/format';
import { cents } from '@/types/branded';
import { addCents } from '@/lib/money';
import { InvoiceForm } from './invoice-form';
import { PaymentForm } from './payment-form';
import { SendInvoiceButton } from './send-invoice-button';

export const metadata: Metadata = { title: 'Invoices' };

export default async function InvoicesPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [invoicesResult, customersResult, uninvoicedResult, contractsResult] =
    await Promise.all([
      listInvoices(supabase),
      listCustomers(supabase),
      listUninvoicedJobs(supabase),
      listContracts(supabase),
    ]);

  const invoices = invoicesResult.ok ? invoicesResult.value : [];
  const customers = customersResult.ok ? customersResult.value : [];
  const uninvoiced = uninvoicedResult.ok ? uninvoicedResult.value : [];
  const contracts = contractsResult.ok ? contractsResult.value : [];
  const customerNames = new Map(customers.map((c) => [c.id, c.companyName]));

  const today = new Date().toISOString().slice(0, 10);

  const outstanding = invoices.filter(
    (invoice) => invoice.status !== 'PAID' && invoice.status !== 'CANCELLED',
  );
  const overdue = outstanding.filter(
    (invoice) => invoice.dueDate !== null && invoice.dueDate < today,
  );

  const outstandingTotal = addCents(
    ...outstanding.map((invoice) => cents(invoice.totalCents - invoice.amountPaidCents)),
  );
  const overdueTotal = addCents(
    ...overdue.map((invoice) => cents(invoice.totalCents - invoice.amountPaidCents)),
  );
  const uninvoicedTotal = addCents(...uninvoiced.map((job) => cents(job.wonPriceCents)));

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Outstanding"
          accent="orange"
          sublabel={`${outstanding.length} invoices`}
        >
          <span className="figure font-semibold text-boyd-light-50">
            {formatCents(outstandingTotal)}
          </span>
        </KpiCard>
        <KpiCard label="Overdue" accent="orange" sublabel={`${overdue.length} invoices`}>
          <span
            className={`figure font-semibold ${
              overdue.length > 0 ? 'text-boyd-negative' : 'text-boyd-light-50'
            }`}
          >
            {formatCents(overdueTotal)}
          </span>
        </KpiCard>
        <KpiCard
          label="Earned, not yet invoiced"
          accent="blue"
          sublabel={`${uninvoiced.length} completed jobs`}
        >
          <span className="figure font-semibold text-boyd-light-50">
            {formatCents(uninvoicedTotal)}
          </span>
        </KpiCard>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel title={`Invoices (${invoices.length})`}>
            {invoices.length === 0 ? (
              <EmptyState>No invoices yet.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {invoices.map((invoice) => {
                  const owing = invoice.totalCents - invoice.amountPaidCents;
                  const isOverdue =
                    invoice.status !== 'PAID' &&
                    invoice.status !== 'CANCELLED' &&
                    invoice.dueDate !== null &&
                    invoice.dueDate < today;

                  return (
                    <li
                      key={invoice.id}
                      className="rounded border border-boyd-navy-700 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="figure font-semibold text-boyd-light-100">
                            {invoice.invoiceNumber}
                          </span>
                          <span className="text-sm text-boyd-light-300">
                            {customerNames.get(invoice.customerId) ?? 'Unknown'}
                          </span>
                          {isOverdue && (
                            <span className="rounded bg-boyd-negative/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-negative">
                              OVERDUE
                            </span>
                          )}
                          {invoice.provenance === 'DEMO' && (
                            <DataBadge kind="DEMO_DATA" />
                          )}
                        </div>
                        <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                          {invoice.status}
                        </span>
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs text-boyd-light-400">Total</dt>
                          <dd className="figure text-boyd-light-100">
                            {formatCents(cents(invoice.totalCents))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-boyd-light-400">Paid</dt>
                          <dd className="figure text-boyd-light-200">
                            {formatCents(cents(invoice.amountPaidCents))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-boyd-light-400">Owing</dt>
                          <dd
                            className={`figure font-semibold ${
                              owing > 0 ? 'text-boyd-warning' : 'text-boyd-positive'
                            }`}
                          >
                            {formatCents(cents(owing))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-boyd-light-400">Due</dt>
                          <dd className="figure text-boyd-light-200">
                            {invoice.dueDate ?? '—'}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        {invoice.status === 'DRAFT' && (
                          <SendInvoiceButton invoiceId={invoice.id} />
                        )}
                        {owing > 0 && invoice.status !== 'CANCELLED' && (
                          <PaymentForm invoiceId={invoice.id} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {contracts.length > 0 && (
            <Panel title={`Contracts (${contracts.length})`}>
              <ul className="space-y-2">
                {contracts.map((contract) => (
                  <li
                    key={contract.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded border border-boyd-navy-700 p-3"
                  >
                    <div>
                      <p className="font-semibold text-boyd-light-100">
                        {contract.title}
                      </p>
                      <p className="text-xs text-boyd-light-400">
                        {customerNames.get(contract.customerId) ?? 'Unknown'}
                        {contract.frequency ? ` · ${contract.frequency}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                        {contract.status}
                      </span>
                      <p className="figure mt-1 text-sm text-boyd-light-200">
                        {contract.agreedRateCents === null ? (
                          <DataBadge kind="NOT_CONFIGURED" title="No rate agreed yet" />
                        ) : (
                          formatCents(cents(contract.agreedRateCents))
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel title="Raise an invoice">
          <InvoiceForm customers={customers} uninvoicedJobs={uninvoiced} />
        </Panel>
      </div>
    </div>
  );
}
