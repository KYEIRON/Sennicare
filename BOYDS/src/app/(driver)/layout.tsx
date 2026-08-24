/**
 * Moh's driver application — mobile first.
 *
 * Requires an authenticated DRIVER session (added in Phase 2). This surface
 * reads jobs through a view that contains no price, cost, contribution, or
 * margin column, and holds no grant on customers, quotes, invoices, or pricing
 * rules. See docs/SECURITY.md and docs/DRIVER_APP.md.
 */
export default function DriverLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-boyd-navy-900">{children}</div>;
}
