/**
 * Partner operations OS — the Command Centre and everything behind it.
 *
 * Requires an authenticated PARTNER or ADMIN session. The guard is added in
 * Phase 2, where authentication arrives; until then this route group holds a
 * placeholder and exposes no data.
 */
export default function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-boyd-navy-950">{children}</div>;
}
