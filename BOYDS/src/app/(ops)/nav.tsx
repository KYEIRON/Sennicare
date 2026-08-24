import Link from 'next/link';

/**
 * Operations navigation, following the supplied dashboard design.
 *
 * Only sections that exist are linked. Nothing here points at a screen that is
 * not built — a dead link implies a capability BOYD'S does not have yet.
 */
const SECTIONS = [
  { href: '/command-centre', label: 'Command Centre' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/customers', label: 'Customers' },
  { href: '/reports', label: 'Reports' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/drivers', label: 'Drivers' },
  { href: '/settings', label: 'Settings' },
] as const;

export function OpsNav({ currentPath }: Readonly<{ currentPath: string }>) {
  return (
    <nav
      aria-label="Operations"
      className="flex gap-1 overflow-x-auto border-b border-boyd-navy-800 bg-boyd-navy-900 px-4"
    >
      {SECTIONS.map((section) => {
        const active = currentPath.startsWith(section.href);
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
