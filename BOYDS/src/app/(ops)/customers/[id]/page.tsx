import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import {
  getCustomer,
  listCustomerContacts,
  listCustomerLocations,
  listCustomerNotes,
  listInvoices,
  listJobsForCustomer,
  listQuotes,
  listRequestsForCustomer,
} from '@/database/operations';
import { EmptyState, KpiCard, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { Figure } from '@/components/ui/figure';
import { formatCents } from '@/lib/format';
import { cents } from '@/types/branded';
import { formatOperatingDate } from '@/lib/datetime';
import {
  totalContribution,
  totalRevenue,
  type SummaryJob,
} from '@/features/command-centre/summary';
import { ContactForm, LocationForm, NoteForm } from './customer-forms';

export const metadata: Metadata = { title: 'Customer' };

/**
 * Everything BOYD'S knows about one customer.
 *
 * The master instruction asks for a complete operational history, and this is
 * it: jobs, quotes, invoices, enquiries, the people, the addresses and the
 * notes, on one page.
 *
 * The two figures at the top are the ones that decide whether this customer is
 * worth keeping. Revenue is a fact — it is what they agreed to pay. Whether
 * BOYD'S made anything on them is not a fact until every cost is recorded, so
 * it says DATA INCOMPLETE and names the jobs responsible rather than showing a
 * flattering number.
 */
export default async function CustomerPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const { id } = await params;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const customerResult = await getCustomer(supabase, id);
  if (!customerResult.ok || !customerResult.value) notFound();
  const customer = customerResult.value;

  const [
    jobsResult,
    quotesResult,
    invoicesResult,
    requestsResult,
    contactsResult,
    locationsResult,
    notesResult,
  ] = await Promise.all([
    listJobsForCustomer(supabase, id),
    listQuotes(supabase, { customerId: id }),
    listInvoices(supabase, { customerId: id }),
    listRequestsForCustomer(supabase, id),
    listCustomerContacts(supabase, id),
    listCustomerLocations(supabase, id),
    listCustomerNotes(supabase, id),
  ]);

  const jobs = jobsResult.ok ? jobsResult.value : [];
  const quotes = quotesResult.ok ? quotesResult.value : [];
  const invoices = invoicesResult.ok ? invoicesResult.value : [];
  const requests = requestsResult.ok ? requestsResult.value : [];
  const contacts = contactsResult.ok ? contactsResult.value : [];
  const locations = locationsResult.ok ? locationsResult.value : [];
  const notes = notesResult.ok ? notesResult.value : [];

  const completed = jobs.filter(
    (job) => job.status === 'COMPLETED',
  ) as unknown as SummaryJob[];

  const outstanding = invoices.filter(
    (invoice) => invoice.status !== 'PAID' && invoice.status !== 'VOID',
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/customers" className="text-sm text-boyd-light-400">
            &larr; Customers
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold text-boyd-light-50">
            {customer.companyName}
            {customer.provenance === 'DEMO' && <DataBadge kind="DEMO_DATA" />}
          </h1>
          <p className="figure mt-1 text-sm text-boyd-light-400">
            {customer.customerNumber} · {customer.customerType.toLowerCase()} ·{' '}
            {customer.customerStatus.toLowerCase()}
            {customer.industryName ? ` · ${customer.industryName}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Jobs completed">
          <span className="figure font-semibold text-boyd-light-50">
            {completed.length}
          </span>
        </KpiCard>

        <KpiCard label="Revenue, completed jobs">
          <Figure calculation={totalRevenue(completed)} format={formatCents} />
        </KpiCard>

        <KpiCard
          label="Contribution"
          accent="positive"
          sublabel="After the costs BOYD’S has recorded against these jobs."
        >
          <Figure calculation={totalContribution(completed)} format={formatCents} />
        </KpiCard>

        <KpiCard
          label="Owed to BOYD’S"
          accent="orange"
          sublabel={`${outstanding.length} unpaid invoice${outstanding.length === 1 ? '' : 's'}`}
        >
          <span className="figure font-semibold text-boyd-light-50">
            {formatCents(
              cents(
                outstanding.reduce(
                  (sum, invoice) => sum + invoice.totalCents - invoice.amountPaidCents,
                  0,
                ),
              ),
            )}
          </span>
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel title={`Jobs (${jobs.length})`}>
            {jobs.length === 0 ? (
              <EmptyState>No jobs yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-boyd-navy-800">
                {jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="figure font-semibold text-boyd-blue-400"
                    >
                      {job.job_number}
                    </Link>
                    <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                      {job.status}
                    </span>
                    <span className="text-sm text-boyd-light-400">
                      {job.description ?? '—'}
                    </span>
                    <span className="figure ml-auto text-xs text-boyd-light-400">
                      {job.scheduled_date
                        ? formatOperatingDate(new Date(`${job.scheduled_date}T12:00:00`))
                        : 'Not scheduled'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Quotes (${quotes.length})`}>
            {quotes.length === 0 ? (
              <EmptyState>Nothing quoted.</EmptyState>
            ) : (
              <ul className="divide-y divide-boyd-navy-800">
                {quotes.map((quote) => (
                  <li key={quote.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="figure font-semibold text-boyd-light-100">
                      {quote.quoteNumber}
                    </span>
                    <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                      {quote.status}
                    </span>
                    <span className="text-sm text-boyd-light-400">
                      {quote.collectionSummary ?? '—'} &rarr;{' '}
                      {quote.deliverySummary ?? '—'}
                    </span>
                    <span className="figure ml-auto text-sm text-boyd-light-200">
                      {formatCents(cents(quote.quotedPriceCents))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Invoices (${invoices.length})`}>
            {invoices.length === 0 ? (
              <EmptyState>Nothing invoiced.</EmptyState>
            ) : (
              <ul className="divide-y divide-boyd-navy-800">
                {invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <span className="figure font-semibold text-boyd-light-100">
                      {invoice.invoiceNumber}
                    </span>
                    <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                      {invoice.status}
                    </span>
                    <span className="text-xs text-boyd-light-400">
                      {invoice.dueDate
                        ? `Due ${formatOperatingDate(new Date(`${invoice.dueDate}T12:00:00`))}`
                        : 'No due date'}
                    </span>
                    <span className="figure ml-auto text-sm text-boyd-light-200">
                      {formatCents(cents(invoice.totalCents))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Enquiries (${requests.length})`}>
            {requests.length === 0 ? (
              <EmptyState>
                No enquiry on this record. A customer added directly, or before enquiries
                were linked, will show none.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-boyd-navy-800">
                {requests.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <span className="figure font-semibold text-boyd-light-100">
                      {request.requestNumber}
                    </span>
                    <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                      {request.status}
                    </span>
                    <span className="text-sm text-boyd-light-400">
                      {request.description ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Notes (${notes.length})`}>
            {notes.length === 0 ? (
              <EmptyState>Nothing recorded yet.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className={`rounded border p-3 ${
                      note.isPinned
                        ? 'border-boyd-orange-500/30 bg-boyd-orange-500/5'
                        : 'border-boyd-navy-700'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line text-boyd-light-200">
                      {note.body}
                    </p>
                    <p className="mt-1 text-xs text-boyd-light-500">
                      {note.authorName ?? 'Unknown'} ·{' '}
                      {formatOperatingDate(new Date(note.createdAt))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Account">
            <dl className="space-y-2 text-sm">
              <Row label="Main contact">{customer.primaryContactName ?? '—'}</Row>
              <Row label="Email">{customer.primaryContactEmail ?? '—'}</Row>
              <Row label="Phone">{customer.primaryContactPhone ?? '—'}</Row>
              <Row label="Payment terms">
                {customer.paymentTermsDays === null ? (
                  <span className="inline-flex items-center gap-2">
                    <DataBadge kind="NOT_CONFIGURED" />
                    <span className="text-boyd-light-400">
                      BOYD&rsquo;S standard terms are still an open decision.
                    </span>
                  </span>
                ) : (
                  `${customer.paymentTermsDays} days`
                )}
              </Row>
              <Row label="Came from">{customer.leadSource ?? '—'}</Row>
              <Row label="On the books since">
                {formatOperatingDate(new Date(customer.createdAt))}
              </Row>
            </dl>
            {customer.notes && (
              <p className="mt-3 border-t border-boyd-navy-700 pt-3 text-sm whitespace-pre-line text-boyd-light-300">
                {customer.notes}
              </p>
            )}
          </Panel>

          <Panel title={`People (${contacts.length})`}>
            {contacts.length === 0 ? (
              <EmptyState>No contacts recorded.</EmptyState>
            ) : (
              <ul className="mb-4 space-y-2">
                {contacts.map((contact) => (
                  <li key={contact.id} className="text-sm">
                    <span className="font-semibold text-boyd-light-100">
                      {contact.name}
                    </span>
                    {contact.isPrimary && (
                      <span className="ml-2 rounded bg-boyd-blue-600/20 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-200">
                        MAIN
                      </span>
                    )}
                    <span className="block text-xs text-boyd-light-400">
                      {[contact.roleTitle, contact.phone, contact.email]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ContactForm customerId={customer.id} />
          </Panel>

          <Panel title={`Addresses (${locations.length})`}>
            {locations.length === 0 ? (
              <EmptyState>No addresses recorded.</EmptyState>
            ) : (
              <ul className="mb-4 space-y-2">
                {locations.map((location) => (
                  <li key={location.id} className="text-sm text-boyd-light-200">
                    <span className="font-semibold">
                      {location.label ?? location.kind.toLowerCase()}
                    </span>
                    {location.isDefault && (
                      <span className="ml-2 text-[10px] font-semibold tracking-wider text-boyd-light-400">
                        DEFAULT
                      </span>
                    )}
                    <span className="block text-xs text-boyd-light-400">
                      {location.addressLine1}, {location.city}, {location.state}{' '}
                      {location.zip}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <LocationForm customerId={customer.id} />
          </Panel>

          <Panel title="Add a note">
            <NoteForm customerId={customer.id} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-boyd-light-400">{label}</dt>
      <dd className="text-right text-boyd-light-200">{children}</dd>
    </div>
  );
}
