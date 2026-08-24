import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    "Get in touch with BOYD'S Logistics LLC about a delivery in North Carolina.",
  alternates: { canonical: '/contact' },
};

/**
 * Contact.
 *
 * BOYD'S has not supplied a public phone number or email address, so none is
 * shown. Inventing one would send a customer nowhere — worse than having no
 * number at all. The request form is a real, working route to the business.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">Get in touch</h1>

      <p className="mt-4 text-boyd-light-300">
        The quickest way to reach us about a delivery is to send the details. It comes
        straight to the people running the jobs, at any hour.
      </p>

      <Link
        href="/request-a-delivery"
        className="mt-8 inline-block rounded-md bg-boyd-orange-600 px-6 py-3 font-semibold text-white hover:bg-boyd-orange-500"
      >
        Request a delivery
      </Link>

      <div className="mt-10 rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-6">
        <h2 className="text-lg font-semibold text-boyd-light-50">
          BOYD&rsquo;S Logistics LLC
        </h2>
        <p className="mt-2 text-sm text-boyd-light-400">
          Business delivery and distribution. Based in North Carolina, serving businesses
          across the state and into neighbouring states.
        </p>
      </div>
    </div>
  );
}
