/**
 * Render a Calculation as a figure on screen.
 *
 * This component is the display end of the honesty rule. A value that is not
 * fully known never renders as a bare number: it renders as its label, with a
 * badge, and the reason available on hover.
 */

import type { Calculation } from '@/lib/calculation';
import { formatCalculation } from '@/lib/format';
import { DataBadge, type DataBadgeKind } from './data-badge';

const BADGE_FOR: Record<Calculation<unknown>['status'], DataBadgeKind | null> = {
  OK: null,
  DATA_INCOMPLETE: 'DATA_INCOMPLETE',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
};

export function Figure<T>({
  calculation,
  format,
  className = '',
}: Readonly<{
  calculation: Calculation<T>;
  format: (value: T) => string;
  className?: string;
}>) {
  const shown = formatCalculation(calculation, format);
  const badge =
    shown.status === 'OK' && shown.needsBadge ? 'ESTIMATE' : BADGE_FOR[shown.status];

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-1.5 ${className}`}>
      <span
        className={
          shown.status === 'OK'
            ? 'figure font-semibold text-boyd-light-50'
            : 'figure text-sm font-semibold text-boyd-light-400'
        }
        title={shown.detail}
      >
        {shown.text}
      </span>
      {badge && <DataBadge kind={badge} title={shown.detail} />}
    </span>
  );
}
