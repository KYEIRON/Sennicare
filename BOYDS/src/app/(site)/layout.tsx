/**
 * Public marketing website.
 *
 * Anonymous visitors only. This surface has NO access to internal profitability,
 * pricing rules, partner information, other customers, financial records, or
 * private documents. See docs/SECURITY.md.
 *
 * Built out in Phase 10.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-boyd-navy-950">{children}</div>;
}
