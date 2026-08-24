import type { Metadata } from 'next';
import Link from 'next/link';
import { POSITIONING, SERVICES, SERVICE_AREAS } from '@/features/site/content';

export const metadata: Metadata = {
  title: "BOYD'S Logistics LLC — Business Delivery in North Carolina",
  description:
    "Same-day, urgent and scheduled business delivery across North Carolina. Direct collection and delivery with proof of delivery. BOYD'S Logistics LLC.",
  alternates: { canonical: '/' },
  openGraph: {
    title: "BOYD'S Logistics LLC",
    description: POSITIONING.subheadline,
    type: 'website',
  },
};

export default function HomePage() {
  return (
    <>
      <section className="border-b border-boyd-navy-800">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h1 className="max-w-3xl text-4xl font-bold text-boyd-light-50 sm:text-5xl">
            {POSITIONING.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-boyd-light-300">
            {POSITIONING.subheadline}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/request-a-delivery"
              className="rounded-md bg-boyd-orange-600 px-6 py-3 font-semibold text-white hover:bg-boyd-orange-500"
            >
              Request a delivery
            </Link>
            <Link
              href="/services"
              className="rounded-md border border-boyd-navy-600 px-6 py-3 font-semibold text-boyd-light-200 hover:border-boyd-blue-500"
            >
              What we do
            </Link>
          </div>

          <p className="mt-6 text-sm text-boyd-light-500">
            Send a request at any hour. We come back to you with what we can actually do.
          </p>
        </div>
      </section>

      <section className="border-b border-boyd-navy-800">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold text-boyd-light-50">What we move</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <Link
                key={service.slug}
                href={`/services/${service.slug}`}
                className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-5 transition-colors hover:border-boyd-blue-500"
              >
                <h3 className="font-semibold text-boyd-light-50">{service.name}</h3>
                <p className="mt-2 text-sm text-boyd-light-400">{service.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-boyd-navy-800">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold text-boyd-light-50">Where we work</h2>
          <p className="mt-3 max-w-2xl text-boyd-light-400">
            BOYD&rsquo;S is based in North Carolina and covers the state, including these
            areas. We also take work into neighbouring states.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {SERVICE_AREAS.map((area) => (
              <li key={area.slug}>
                <Link
                  href={`/service-areas/${area.slug}`}
                  className="inline-block rounded border border-boyd-navy-700 px-3 py-1.5 text-sm text-boyd-light-300 hover:border-boyd-blue-500"
                >
                  {area.city}, {area.state}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold text-boyd-light-50">Why businesses use us</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <h3 className="font-semibold text-boyd-light-100">
                One driver, door to door
              </h3>
              <p className="mt-2 text-sm text-boyd-light-400">
                Your delivery is collected and delivered by the same person. It is not
                handed off, sorted, or held at a depot.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-boyd-light-100">You reach a person</h3>
              <p className="mt-2 text-sm text-boyd-light-400">
                BOYD&rsquo;S is small and direct about it. When you call, you reach
                someone who knows where your delivery is.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-boyd-light-100">Proof at the door</h3>
              <p className="mt-2 text-sm text-boyd-light-400">
                Every delivery is signed for or photographed, with the recipient recorded
                by name and the time captured automatically.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
