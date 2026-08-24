import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SERVICES, SERVICE_AREAS } from '@/features/site/content';

export function generateStaticParams() {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = SERVICES.find((s) => s.slug === slug);
  if (!service) return {};

  return {
    title: `${service.name} in North Carolina`,
    description: service.metaDescription,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: { title: service.name, description: service.metaDescription },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = SERVICES.find((s) => s.slug === slug);
  if (!service) notFound();

  // Structured data describes only what BOYD'S actually offers. There is no
  // aggregateRating and no review: fabricating either would be a false claim
  // in a form search engines treat as authoritative.
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.summary,
    provider: {
      '@type': 'LocalBusiness',
      name: "BOYD'S Logistics LLC",
      areaServed: SERVICE_AREAS.map((area) => ({
        '@type': 'City',
        name: `${area.city}, ${area.state}`,
      })),
    },
    areaServed: { '@type': 'State', name: 'North Carolina' },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-boyd-light-500">
        <Link href="/services" className="hover:text-boyd-light-300">
          Services
        </Link>
        <span className="mx-2">/</span>
        <span className="text-boyd-light-400">{service.name}</span>
      </nav>

      <h1 className="mt-4 text-3xl font-bold text-boyd-light-50 sm:text-4xl">
        {service.name} in North Carolina
      </h1>
      <p className="mt-4 text-lg text-boyd-light-300">{service.summary}</p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-boyd-light-50">Who it is for</h2>
        <p className="mt-3 text-boyd-light-300">{service.whoItIsFor}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-boyd-light-50">How it works</h2>
        <ul className="mt-4 space-y-2">
          {service.whatWeDo.map((point) => (
            <li key={point} className="flex gap-3 text-boyd-light-300">
              <span className="text-boyd-orange-500" aria-hidden="true">
                &#8594;
              </span>
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-6">
        <h2 className="text-xl font-semibold text-boyd-light-50">What it costs</h2>
        <p className="mt-3 text-boyd-light-300">
          It depends on the distance, the timing and what is being moved. We quote each
          job rather than publishing a rate that would be wrong for most of them. Send us
          the details and we will come back with a price.
        </p>
        <Link
          href="/request-a-delivery"
          className="mt-5 inline-block rounded-md bg-boyd-orange-600 px-6 py-3 font-semibold text-white hover:bg-boyd-orange-500"
        >
          Request a delivery
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-boyd-light-50">Where we cover</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {SERVICE_AREAS.map((area) => (
            <li key={area.slug}>
              <Link
                href={`/service-areas/${area.slug}`}
                className="inline-block rounded border border-boyd-navy-700 px-3 py-1.5 text-sm text-boyd-light-300 hover:border-boyd-blue-500"
              >
                {area.city}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
