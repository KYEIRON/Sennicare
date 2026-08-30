import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { listIncidents } from '@/database/operations';
import { EmptyState, Panel } from '@/components/ui/kpi-card';
import { formatOperatingDate, formatOperatingTime } from '@/lib/datetime';
import { formatCents } from '@/lib/format';
import { parseStoredCents } from '@/services/finance/job-costs';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  type IncidentSeverity,
} from '@/types/operations';
import { IncidentReview } from './incident-review';

export const metadata: Metadata = { title: 'Incidents' };

const SEVERITY_STYLES: Readonly<Record<IncidentSeverity, string>> = {
  MINOR: 'border-boyd-navy-700',
  SERIOUS: 'border-boyd-warning/40 bg-boyd-warning/5',
  CRITICAL: 'border-boyd-negative/40 bg-boyd-negative/5',
};

/**
 * What has gone wrong, and what BOYD'S did about it.
 *
 * The driver's account is shown exactly as filed and is not editable here. A
 * partner records the outcome alongside it, and the cost once it is known —
 * until then it reads "not established", because an incident that cost nothing
 * is a different thing from one nobody has costed.
 */
export default async function IncidentsPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const supabase = await getServerClient();
  if (!supabase) return null;

  const result = await listIncidents(supabase);
  const incidents = result.ok ? result.value : [];

  const open = incidents.filter(
    (incident) => incident.status === 'REPORTED' || incident.status === 'UNDER_REVIEW',
  );
  const closed = incidents.filter(
    (incident) => incident.status === 'RESOLVED' || incident.status === 'CLOSED',
  );

  return (
    <div className="space-y-4">
      <Panel title={`Open (${open.length})`}>
        {open.length === 0 ? (
          <EmptyState>Nothing outstanding.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {open.map((incident) => (
              <li
                key={incident.id}
                className={`rounded border p-4 ${SEVERITY_STYLES[incident.severity]}`}
              >
                <IncidentBody incident={incident} />
                <IncidentReview
                  incidentId={incident.id}
                  currentStatus={incident.status}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Closed (${closed.length})`}>
        {closed.length === 0 ? (
          <EmptyState>Nothing closed yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {closed.map((incident) => (
              <li
                key={incident.id}
                className="rounded border border-boyd-navy-700 p-4 opacity-80"
              >
                <IncidentBody incident={incident} />
                {incident.resolutionNotes && (
                  <p className="mt-3 rounded bg-boyd-navy-950 p-3 text-sm text-boyd-light-300">
                    <span className="text-xs text-boyd-light-500">What was done: </span>
                    {incident.resolutionNotes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function IncidentBody({
  incident,
}: Readonly<{
  incident: {
    incidentNumber: string;
    incidentType: keyof typeof INCIDENT_TYPE_LABELS;
    severity: IncidentSeverity;
    occurredAt: string;
    locationDescription: string | null;
    description: string;
    anyoneInjured: boolean;
    policeInvolved: boolean;
    policeReportNumber: string | null;
    thirdPartyInvolved: boolean;
    thirdPartyDetails: string | null;
    goodsAffected: boolean;
    costCents: string | number | null;
    jobId: string | null;
    jobNumber: string | null;
    driverName: string | null;
    vehicleCode: string | null;
  };
}>) {
  const occurred = new Date(incident.occurredAt);
  const costCents = parseStoredCents(incident.costCents);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="figure font-semibold text-boyd-light-100">
            {incident.incidentNumber}
          </span>
          <span className="text-sm text-boyd-light-200">
            {INCIDENT_TYPE_LABELS[incident.incidentType]}
          </span>
          <span className="rounded bg-boyd-navy-800 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-300">
            {INCIDENT_SEVERITY_LABELS[incident.severity].split(' — ')[0]?.toUpperCase()}
          </span>
        </div>
        <span className="figure text-xs text-boyd-light-400">
          {formatOperatingDate(occurred)} {formatOperatingTime(occurred)}
        </span>
      </div>

      <p className="mt-3 text-sm whitespace-pre-line text-boyd-light-200">
        {incident.description}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Fact label="Where">{incident.locationDescription ?? 'Not recorded'}</Fact>
        <Fact label="Van">{incident.vehicleCode ?? 'Not recorded'}</Fact>
        <Fact label="Driver">{incident.driverName ?? 'Not recorded'}</Fact>
        <Fact label="Job">
          {incident.jobId && incident.jobNumber ? (
            <Link href={`/jobs/${incident.jobId}`} className="text-boyd-blue-400">
              {incident.jobNumber}
            </Link>
          ) : (
            'Not on a job'
          )}
        </Fact>
        <Fact label="Anyone hurt">{incident.anyoneInjured ? 'Yes' : 'No'}</Fact>
        <Fact label="Police">
          {incident.policeInvolved
            ? (incident.policeReportNumber ?? 'Yes, no report number given')
            : 'No'}
        </Fact>
        <Fact label="Anyone else">{incident.thirdPartyInvolved ? 'Yes' : 'No'}</Fact>
        <Fact label="Cost to BOYD’S">
          {/*
            Never "$0.00" for an unknown. A cost of nothing is a claim, and
            Number('') is 0 — so the value goes through the same parser the
            financial engine uses rather than a coercion.
          */}
          {costCents === null ? 'NOT ESTABLISHED' : formatCents(costCents)}
        </Fact>
      </dl>

      {incident.thirdPartyDetails && (
        <p className="mt-2 text-sm text-boyd-light-400">{incident.thirdPartyDetails}</p>
      )}
      {incident.goodsAffected && (
        <p className="mt-2 text-sm text-boyd-warning">
          The load was affected. The customer needs to be told.
        </p>
      )}
    </>
  );
}

function Fact({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-xs text-boyd-light-400">{label}</dt>
      <dd className="text-boyd-light-200">{children}</dd>
    </div>
  );
}
