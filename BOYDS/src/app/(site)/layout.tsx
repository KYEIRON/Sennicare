import Link from 'next/link';

/**
 * The public marketing website.
 *
 * Anonymous visitors only. This surface has no access to internal
 * profitability, pricing rules, partner information, other customers, financial
 * records, or private documents — see docs/SECURITY.md. The one thing it can
 * write is a job request, through a single controlled function.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-boyd-navy-950">
      <header className="border-b border-boyd-navy-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="block">
            <span className="block text-xs font-semibold tracking-[0.2em] text-boyd-orange-500 uppercase">
              BOYD&rsquo;S
            </span>
            <span className="block text-lg font-bold text-boyd-light-50">
              Logistics LLC
            </span>
          </Link>

          <nav aria-label="Main" className="flex flex-wrap items-center gap-5 text-sm">
            <Link
              href="/services"
              className="text-boyd-light-300 hover:text-boyd-light-50"
            >
              Services
            </Link>
            <Link
              href="/service-areas"
              className="text-boyd-light-300 hover:text-boyd-light-50"
            >
              Service areas
            </Link>
            <Link href="/about" className="text-boyd-light-300 hover:text-boyd-light-50">
              About
            </Link>
            <Link href="/faq" className="text-boyd-light-300 hover:text-boyd-light-50">
              FAQ
            </Link>
            <Link
              href="/request-a-delivery"
              className="rounded-md bg-boyd-orange-600 px-4 py-2 font-semibold text-white hover:bg-boyd-orange-500"
            >
              Request a delivery
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-boyd-navy-800 bg-boyd-navy-900">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-boyd-orange-500 uppercase">
                BOYD&rsquo;S Logistics LLC
              </p>
              <p className="mt-2 text-sm text-boyd-light-400">
                Business delivery and distribution, based in North Carolina.
              </p>
            </div>

            <nav aria-label="Services">
              <h2 className="text-xs font-semibold tracking-wider text-boyd-light-300 uppercase">
                Services
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  <Link
                    href="/services/same-day-delivery"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    Same day delivery
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services/urgent-business-delivery"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    Urgent business delivery
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services/dedicated-van-delivery"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    Dedicated van delivery
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services/medical-courier"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    Medical courier
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Company">
              <h2 className="text-xs font-semibold tracking-wider text-boyd-light-300 uppercase">
                Company
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  <Link
                    href="/about"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-boyd-light-400 hover:text-boyd-light-100"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <p className="mt-8 border-t border-boyd-navy-800 pt-6 text-xs text-boyd-light-500">
            &copy; {new Date().getFullYear()} BOYD&rsquo;S Logistics LLC. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
