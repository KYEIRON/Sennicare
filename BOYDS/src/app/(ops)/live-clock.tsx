'use client';

import { useEffect, useState } from 'react';
import { formatOperatingDate, formatOperatingTime } from '@/lib/datetime';

/**
 * The header's date and time, in BOYD'S operating time zone.
 *
 * It keeps ticking. The ops layout is rendered once and stays mounted while
 * the user works, so a time computed on the server froze at sign-in — a
 * dispatcher with the app open all morning would have read a stale clock.
 * Starts from the server's time so the first render matches exactly.
 */
export function LiveClock({ initial }: Readonly<{ initial: string }>) {
  const [now, setNow] = useState(() => new Date(initial));

  useEffect(() => {
    // Only the interval updates state; the first render already shows the
    // server's time, so there is nothing to correct on mount.
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <p className="text-sm text-boyd-light-300">{formatOperatingDate(now)}</p>
      <p className="figure text-sm text-boyd-light-400">{formatOperatingTime(now)}</p>
    </div>
  );
}
