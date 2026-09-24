/**
 * Which navigation section a path belongs to.
 *
 * Exact match, or the section followed by a slash — so `/customers/abc` is in
 * Customers, but a future `/customers-archive` would not be.
 */
export function isActiveSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
