import type { Metadata } from 'next';
import Link from 'next/link';
import { SERVICES } from '@/features/site/content';

export const metadata: Metadata = {
  title: 'Services',
  description:
    "Same-day, urgent, dedicated van, medical courier, industrial parts and scheduled distribution across North Carolina. BOYD'S Logistics LLC.",
  alternates: { canonical: '/services' },
};

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">What BOYD&rsquo;S does</h1>
      <p className="mt-4 max-w-2xl text-boyd-light-300">
        Every job is direct: collected by one driver and delivered by the same driver,
        with proof captured at the door.
      </p>

      <div className="mt-10 space-y-4">
        {SERVICES.map((service) => (
          <article
            key={service.slug}
            className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-6"
          >
            <h2 className="text-xl font-semibold text-boyd-light-50">
              <Link
                href={`/services/${service.slug}`}
                className="hover:text-boyd-blue-300"
              >
                {service.name}
              </Link>
            </h2>
            <p className="mt-2 text-boyd-light-300">{service.summary}</p>
            <p className="mt-3 text-sm text-boyd-light-400">{service.whoItIsFor}</p>
            <Link
              href={`/services/${service.slug}`}
              className="mt-4 inline-block text-sm font-semibold text-boyd-blue-300 hover:underline"
            >
              More about {service.name.toLowerCase()} &rarr;
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
