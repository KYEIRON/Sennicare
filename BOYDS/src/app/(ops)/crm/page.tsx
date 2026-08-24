import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listLeads } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { formatCents } from '@/lib/format';
import { cents } from '@/types/branded';
import { LEAD_STAGES } from '@/validation/crm';
import { LeadForm } from './lead-form';
import { StageForm } from './stage-form';

export const metadata: Metadata = { title: 'CRM' };

/** Stages that are still live work, in pipeline order. */
const ACTIVE_STAGES = LEAD_STAGES.filter(
  (stage) => stage !== 'LOST' && stage !== 'WON' && stage !== 'REPEAT_CUSTOMER',
);

export default async function CrmPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const result = await listLeads(supabase);
  const leads = result.ok ? result.value : [];

  const today = new Date().toISOString().slice(0, 10);

  const overdue = leads.filter(
    (lead) =>
      lead.nextFollowupAt !== null &&
      lead.nextFollowupAt <= today &&
      lead.stage !== 'WON' &&
      lead.stage !== 'LOST',
  );

  const unscheduled = leads.filter(
    (lead) =>
      lead.nextFollowupAt === null && lead.stage !== 'WON' && lead.stage !== 'LOST',
  );

  const contractOpportunities = leads.filter((lead) => lead.isRecurringOpportunity);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {(overdue.length > 0 || unscheduled.length > 0) && (
            <Panel title="Follow-ups">
              {overdue.length > 0 && (
                <>
                  <h3 className="mb-2 text-xs font-semibold tracking-wider text-boyd-warning uppercase">
                    Due or overdue ({overdue.length})
                  </h3>
                  <ul className="mb-4 space-y-2">
                    {overdue.map((lead) => (
                      <li
                        key={lead.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded border border-boyd-warning/30 bg-boyd-warning/5 p-3"
                      >
                        <span className="text-sm font-semibold text-boyd-light-100">
                          {lead.companyName}
                        </span>
                        <span className="figure text-xs text-boyd-light-400">
                          {lead.nextFollowupAt}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {unscheduled.length > 0 && (
                <>
                  <h3 className="mb-2 text-xs font-semibold tracking-wider text-boyd-light-400 uppercase">
                    No follow-up date set ({unscheduled.length})
                  </h3>
                  <p className="mb-2 text-xs text-boyd-light-500">
                    An open lead with no next step tends to become a lost one.
                  </p>
                  <ul className="space-y-1">
                    {unscheduled.map((lead) => (
                      <li key={lead.id} className="text-sm text-boyd-light-300">
                        {lead.companyName}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}

          <Panel title={`Pipeline (${leads.length})`}>
            {leads.length === 0 ? (
              <EmptyState>
                No leads yet. BOYD&rsquo;S pipeline is built from real enquiries — none
                are seeded.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {ACTIVE_STAGES.map((stage) => {
                  const inStage = leads.filter((lead) => lead.stage === stage);
                  if (inStage.length === 0) return null;

                  return (
                    <section key={stage}>
                      <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-boyd-orange-400 uppercase">
                        {stage.replace(/_/g, ' ')} ({inStage.length})
                      </h3>
                      <ul className="space-y-2">
                        {inStage.map((lead) => (
                          <li
                            key={lead.id}
                            className="rounded border border-boyd-navy-700 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-boyd-light-100">
                                  {lead.companyName}
                                </span>
                                {lead.isRecurringOpportunity && (
                                  <span className="rounded bg-boyd-orange-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-orange-400">
                                    RECURRING
                                  </span>
                                )}
                                {lead.provenance === 'DEMO' && (
                                  <DataBadge kind="DEMO_DATA" />
                                )}
                              </div>
                              <span className="figure text-sm text-boyd-light-400">
                                {lead.estimatedValueCents === null
                                  ? '—'
                                  : formatCents(cents(lead.estimatedValueCents))}
                              </span>
                            </div>
                            {lead.contactName && (
                              <p className="mt-1 text-xs text-boyd-light-400">
                                {lead.contactName}
                                {lead.contactPhone ? ` · ${lead.contactPhone}` : ''}
                              </p>
                            )}
                            <div className="mt-2">
                              <StageForm leadId={lead.id} currentStage={lead.stage} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </Panel>

          {contractOpportunities.length > 0 && (
            <Panel title={`Contract opportunities (${contractOpportunities.length})`}>
              <p className="mb-3 text-sm text-boyd-light-400">
                Customers who mentioned recurring work. Recurring work is how BOYD&rsquo;S
                moves from one-off jobs to contracts.
              </p>
              <ul className="space-y-2">
                {contractOpportunities.map((lead) => (
                  <li key={lead.id} className="rounded border border-boyd-navy-700 p-3">
                    <span className="font-semibold text-boyd-light-100">
                      {lead.companyName}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel title="Add a lead">
          <LeadForm />
        </Panel>
      </div>
    </div>
  );
}
