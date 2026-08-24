import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listCustomers, listIndustries } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { CustomerForm } from './customer-form';

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const [customersResult, industriesResult] = await Promise.all([
    listCustomers(supabase),
    listIndustries(supabase),
  ]);

  const customers = customersResult.ok ? customersResult.value : [];
  const industries = industriesResult.ok ? industriesResult.value : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title={`Customers (${customers.length})`}>
          {customers.length === 0 ? (
            <EmptyState>
              No customers yet. BOYD&rsquo;S customer records are added here as real
              business comes in — none are seeded.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] tracking-wider text-boyd-light-400 uppercase">
                  <tr className="border-b border-boyd-navy-800">
                    <th className="pb-2 pr-3 font-semibold">Number</th>
                    <th className="pb-2 pr-3 font-semibold">Company</th>
                    <th className="pb-2 pr-3 font-semibold">Type</th>
                    <th className="pb-2 pr-3 font-semibold">Contact</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-boyd-navy-800/60">
                      <td className="figure py-2.5 pr-3 text-boyd-light-400">
                        {customer.customerNumber}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-semibold text-boyd-light-100">
                          {customer.companyName}
                        </span>
                        {customer.provenance === 'DEMO' && (
                          <span className="ml-2">
                            <DataBadge kind="DEMO_DATA" />
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-boyd-light-400">
                        {customer.customerType.toLowerCase()}
                      </td>
                      <td className="py-2.5 pr-3 text-boyd-light-400">
                        {customer.primaryContactName ?? '—'}
                      </td>
                      <td className="py-2.5">
                        <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
                          {customer.customerStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Add a customer">
        <CustomerForm industries={industries} />
      </Panel>
    </div>
  );
}
