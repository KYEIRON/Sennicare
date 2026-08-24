import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listCustomers, listJobTypes, listQuotes } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { formatCents, formatMiles } from '@/lib/format';
import { cents, milesTenths } from '@/types/branded';
import { QuoteForm } from './quote-form';
import { QuoteStatusForm } from './quote-status-form';

export const metadata: Metadata = { title: 'Quotes' };

export default async function QuotesPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [quotesResult, customersResult, typesResult] = await Promise.all([
    listQuotes(supabase),
    listCustomers(supabase),
    listJobTypes(supabase),
  ]);

  const quotes = quotesResult.ok ? quotesResult.value : [];
  const customers = customersResult.ok ? customersResult.value : [];
  const jobTypes = typesResult.ok ? typesResult.value : [];
  const customerNames = new Map(customers.map((c) => [c.id, c.companyName]));

  const today = new Date().toISOString().slice(0, 10);

  const sent = quotes.filter((q) => q.status === 'SENT' || q.status === 'VIEWED');
  const accepted = quotes.filter((q) => q.status === 'ACCEPTED');
  const conversion =
    sent.length + accepted.length > 0
      ? Math.round((accepted.length / (sent.length + accepted.length)) * 100)
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Panel title={`Quotes (${quotes.length})`}>
          {quotes.length === 0 ? (
            <EmptyState>No quotes yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {quotes.map((quote) => {
                const expired =
                  quote.validUntil !== null &&
                  quote.validUntil < today &&
                  (quote.status === 'SENT' || quote.status === 'VIEWED');

                return (
                  <li key={quote.id} className="rounded border border-boyd-navy-700 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="figure font-semibold text-boyd-light-100">
                          {quote.quoteNumber}
                        </span>
                        <span className="text-sm text-boyd-light-300">
                          {customerNames.get(quote.customerId ?? '') ??
                            'Unknown customer'}
                        </span>
                        {quote.belowMinimumOverride && (
                          <span className="rounded bg-boyd-warning/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-warning">
                            BELOW MINIMUM
                          </span>
                        )}
                        {expired && (
                          <span className="rounded bg-boyd-negative/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-negative">
                            EXPIRED
                          </span>
                        )}
                        {quote.provenance === 'DEMO' && <DataBadge kind="DEMO_DATA" />}
                      </div>
                      <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                        {quote.status}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-boyd-light-400">Quoted</dt>
                        <dd className="figure font-semibold text-boyd-light-100">
                          {formatCents(cents(quote.quotedPriceCents))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-boyd-light-400">Estimated cost</dt>
                        <dd className="figure text-boyd-light-200">
                          {quote.estimatedCostCents === null ? (
                            <DataBadge
                              kind="DATA_INCOMPLETE"
                              title="The cost estimate could not be completed from recorded data."
                            />
                          ) : (
                            formatCents(cents(quote.estimatedCostCents))
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-boyd-light-400">
                          Expected contribution
                        </dt>
                        <dd className="figure text-boyd-light-200">
                          {quote.expectedContributionCents === null ? (
                            <DataBadge kind="DATA_INCOMPLETE" />
                          ) : (
                            formatCents(cents(quote.expectedContributionCents))
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-boyd-light-400">Distance</dt>
                        <dd className="figure text-boyd-light-200">
                          {quote.estimatedMilesTenths === null
                            ? '—'
                            : formatMiles(milesTenths(quote.estimatedMilesTenths))}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3">
                      <QuoteStatusForm quoteId={quote.id} currentStatus={quote.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Conversion">
          {conversion === null ? (
            <EmptyState>No quotes have been sent yet.</EmptyState>
          ) : (
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-boyd-light-400">Sent or viewed</p>
                <p className="figure text-xl font-semibold text-boyd-light-50">
                  {sent.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-boyd-light-400">Accepted</p>
                <p className="figure text-xl font-semibold text-boyd-positive">
                  {accepted.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-boyd-light-400">Conversion</p>
                <p className="figure text-xl font-semibold text-boyd-light-50">
                  {conversion}%
                </p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="New quote">
        <QuoteForm customers={customers} jobTypes={jobTypes} />
      </Panel>
    </div>
  );
}
