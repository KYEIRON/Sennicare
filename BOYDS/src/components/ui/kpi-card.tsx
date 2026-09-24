/**
 * A Command Centre metric card.
 *
 * Follows the supplied dashboard design. The figures inside are always real
 * BOYD'S data or an explicit label — never an illustrative number borrowed from
 * the design reference.
 */

export function KpiCard({
  label,
  children,
  sublabel,
  accent = 'blue',
}: Readonly<{
  label: string;
  children: React.ReactNode;
  sublabel?: React.ReactNode;
  accent?: 'blue' | 'orange' | 'positive' | 'neutral';
}>) {
  const accents = {
    blue: 'bg-boyd-blue-500/15 text-boyd-blue-300',
    orange: 'bg-boyd-orange-500/15 text-boyd-orange-400',
    positive: 'bg-boyd-positive/15 text-boyd-positive',
    neutral: 'bg-boyd-light-500/15 text-boyd-light-400',
  } as const;

  return (
    <div className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-boyd-light-400 uppercase">
          {label}
        </p>
        <span
          className={`h-6 w-6 shrink-0 rounded ${accents[accent]}`}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 text-2xl">{children}</div>
      {sublabel && <p className="mt-1.5 text-xs text-boyd-light-400">{sublabel}</p>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: Readonly<{ title: string; action?: React.ReactNode; children: React.ReactNode }>) {
  return (
    <section className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-900">
      <header className="flex items-center justify-between gap-3 border-b border-boyd-navy-800 px-4 py-3">
        <h2 className="text-[11px] font-semibold tracking-[0.12em] text-boyd-light-300 uppercase">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="py-6 text-center text-sm text-boyd-light-500">{children}</p>;
}
