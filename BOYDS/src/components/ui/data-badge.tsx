/**
 * The badges that keep BOYD'S honest.
 *
 * Any figure the system cannot fully stand behind is shown with one of these.
 * There is no variant for "probably fine" — a number is either solid, or it
 * says exactly what is wrong with it.
 */

export type DataBadgeKind =
  | 'DEMO_DATA'
  | 'DATA_INCOMPLETE'
  | 'NOT_CALCULABLE'
  | 'NOT_CONFIGURED'
  | 'ESTIMATE'
  | 'UNAVAILABLE'
  | 'BEFORE_LABOUR_COST';

const LABELS: Record<DataBadgeKind, string> = {
  DEMO_DATA: 'DEMO DATA',
  DATA_INCOMPLETE: 'DATA INCOMPLETE',
  NOT_CALCULABLE: 'NOT CALCULABLE',
  NOT_CONFIGURED: 'NOT CONFIGURED',
  ESTIMATE: 'ESTIMATE',
  UNAVAILABLE: 'UNAVAILABLE',
  BEFORE_LABOUR_COST: 'BEFORE LABOUR COST',
};

const STYLES: Record<DataBadgeKind, string> = {
  DEMO_DATA: 'border-boyd-orange-500/40 bg-boyd-orange-500/10 text-boyd-orange-400',
  DATA_INCOMPLETE: 'border-boyd-incomplete/40 bg-boyd-incomplete/10 text-boyd-incomplete',
  NOT_CALCULABLE: 'border-boyd-light-500/40 bg-boyd-light-500/10 text-boyd-light-400',
  NOT_CONFIGURED: 'border-boyd-light-500/40 bg-boyd-light-500/10 text-boyd-light-400',
  ESTIMATE: 'border-boyd-info/40 bg-boyd-info/10 text-boyd-info',
  UNAVAILABLE: 'border-boyd-unavailable/40 bg-boyd-unavailable/10 text-boyd-light-400',
  BEFORE_LABOUR_COST: 'border-boyd-info/40 bg-boyd-info/10 text-boyd-info',
};

export function DataBadge({
  kind,
  title,
}: Readonly<{ kind: DataBadgeKind; title?: string | undefined }>) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider whitespace-nowrap ${STYLES[kind]}`}
    >
      {LABELS[kind]}
    </span>
  );
}
