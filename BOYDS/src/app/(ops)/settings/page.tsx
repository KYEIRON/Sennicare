import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth/session';
import { capabilityReport } from '@/lib/env';
import { Panel } from '@/components/ui/kpi-card';
import { DataBadge } from '@/components/ui/data-badge';
import { BUSINESS_SETTINGS } from '@/lib/configured';

export const metadata: Metadata = { title: 'Settings' };

/**
 * What is connected, and what has not been decided.
 *
 * This page is how BOYD'S tells the truth about itself: which integrations are
 * live, and which business policies are still open. Nothing here is dressed up
 * as working when it is not.
 */
const OPEN_DECISIONS: Record<string, string> = {
  [BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_JOB]:
    'The dollar floor below which BOYD’S declines a job.',
  [BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_MILE]:
    'The per-mile floor below which BOYD’S declines a job.',
  [BUSINESS_SETTINGS.TARGET_CONTRIBUTION_MARGIN]:
    'The margin the pricing engine aims for.',
  [BUSINESS_SETTINGS.DRIVER_LABOUR_COST_BASIS]:
    'How driving labour is costed into a job for management analysis. Separate from how a partner is actually compensated.',
  [BUSINESS_SETTINGS.VEHICLE_COST_ALLOCATION_BASIS]:
    'How the van’s derived running cost is spread across jobs.',
  [BUSINESS_SETTINGS.SERVICE_AREA_RADIUS]:
    'The radius and counties BOYD’S serves. North Carolina is recorded; the detail is not.',
  [BUSINESS_SETTINGS.MEDICAL_COURIER_LIMITS]:
    'What BOYD’S will and will not carry. No certification claim appears anywhere until verified.',
  [BUSINESS_SETTINGS.DEFAULT_PAYMENT_TERMS]: 'Standard invoice payment terms.',
  [BUSINESS_SETTINGS.QUOTE_VALIDITY_PERIOD]: 'How long a quote stays open.',
  [BUSINESS_SETTINGS.AUTO_ACCEPTANCE_THRESHOLDS]:
    'Not needed yet. Automatic acceptance is disabled at the database and cannot be enabled until the availability, location and pricing integrations are live.',
};

export default async function SettingsPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const capabilities = capabilityReport();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Connected capabilities">
        <ul className="space-y-2">
          {capabilities.map((capability) => (
            <li
              key={capability.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-boyd-navy-700 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-boyd-light-100">
                  {capability.name}
                </p>
                <p className="text-xs text-boyd-light-400">{capability.requires}</p>
              </div>
              {capability.available ? (
                <span className="rounded bg-boyd-positive/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-positive">
                  CONNECTED
                </span>
              ) : (
                <DataBadge kind="UNAVAILABLE" />
              )}
            </li>
          ))}

          {[
            { name: 'Maps and live tracking', requires: 'A maps provider API key' },
            { name: 'BOYD’S AI', requires: 'An AI provider API key' },
            { name: 'Outbound email', requires: 'An email provider account' },
            { name: 'Outbound SMS', requires: 'An SMS provider account' },
          ].map((capability) => (
            <li
              key={capability.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-boyd-navy-700 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-boyd-light-100">
                  {capability.name}
                </p>
                <p className="text-xs text-boyd-light-400">{capability.requires}</p>
              </div>
              <DataBadge kind="UNAVAILABLE" />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-boyd-light-500">
          An unavailable capability shows its state plainly rather than pretending to
          work. Nothing is simulated.
        </p>
      </Panel>

      <Panel title="Open business decisions">
        <ul className="space-y-2">
          {Object.entries(OPEN_DECISIONS).map(([setting, description]) => (
            <li key={setting} className="rounded border border-boyd-navy-700 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-boyd-light-100">
                  {setting.replace(/_/g, ' ')}
                </p>
                <DataBadge kind="NOT_CONFIGURED" />
              </div>
              <p className="mt-1 text-xs text-boyd-light-400">{description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-boyd-light-500">
          These are decisions for the partners. BOYD&rsquo;S shows NOT CONFIGURED rather
          than assuming a value, so no figure ever rests on an invented policy.
        </p>
      </Panel>
    </div>
  );
}
