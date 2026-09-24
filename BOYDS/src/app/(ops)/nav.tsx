'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActiveSection } from '@/lib/navigation';

/**
 * Operations navigation, following the supplied dashboard design.
 *
 * Only sections that exist are linked. Nothing here points at a screen that is
 * not built — a dead link implies a capability BOYD'S does not have yet.
 */
const SECTIONS = [
  { href: '/command-centre', label: 'Command Centre' },
  { href: '/requests', label: 'Requests' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/customers', label: 'Customers' },
  { href: '/crm', label: 'CRM' },
  { href: '/quotes', label: 'Quotes' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/reports', label: 'Reports' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/drivers', label: 'Drivers' },
  { href: '/team', label: 'Team' },
  { href: '/assistant', label: 'BOYD’S AI' },
  { href: '/settings', label: 'Settings' },
] as const;

/**
 * A client component on purpose. The ops layout is rendered once and kept
 * mounted while the user moves between sections, so a path passed down from
 * the server goes stale on the first click — the menu kept underlining
 * whichever page was opened first. usePathname() follows every navigation.
 */
export function OpsNav() {
  const currentPath = usePathname() ?? '';

  return (
    <nav
      aria-label="Operations"
      className="flex gap-1 overflow-x-auto border-b border-boyd-navy-800 bg-boyd-navy-900 px-4"
    >
      {SECTIONS.map((section) => {
        const active = isActiveSection(currentPath, section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={`border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors ${
              active
                ? 'border-boyd-orange-500 font-semibold text-boyd-light-50'
                : 'border-transparent text-boyd-light-400 hover:text-boyd-light-100'
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
