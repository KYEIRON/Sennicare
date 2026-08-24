import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SERVICES, SERVICE_AREAS } from '@/features/site/content';

export function generateStaticParams() {
  return SERVICE_AREAS.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = SERVICE_AREAS.find((a) => a.slug === slug);
  if (!area) return {};

  return {
    title: `Delivery in ${area.city}, ${area.state}`,
    description: `Same-day and scheduled business delivery in ${area.city}, ${area.state}. Direct collection and delivery with proof of delivery.`,
    alternates: { canonical: `/service-areas/${area.slug}` },
  };
}

export default async function ServiceAreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = SERVICE_AREAS.find((a) => a.slug === slug);
  if (!area) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <nav aria-label="Breadcrumb" className="text-sm text-boyd-light-500">
        <Link href="/service-areas" className="hover:text-boyd-light-300">
          Service areas
        </Link>
        <span className="mx-2">/</span>
        <span className="text-boyd-light-400">{area.city}</span>
      </nav>

      <h1 className="mt-4 text-3xl font-bold text-boyd-light-50 sm:text-4xl">
        Business delivery in {area.city}, {area.state}
      </h1>
      <p className="mt-4 text-lg text-boyd-light-300">{area.description}</p>

      <p className="mt-4 text-sm text-boyd-light-500">
        BOYD&rsquo;S covers {area.city} as a service area. We do not have premises here —
        the van comes to you.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-boyd-light-50">
          What we can move in {area.city}
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SERVICES.map((service) => (
            <li key={service.slug}>
              <Link
                href={`/services/${service.slug}`}
                className="block rounded border border-boyd-navy-700 p-4 text-sm hover:border-boyd-blue-500"
              >
                <span className="font-semibold text-boyd-light-100">{service.name}</span>
                <span className="mt-1 block text-boyd-light-400">{service.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/request-a-delivery"
        className="mt-10 inline-block rounded-md bg-boyd-orange-600 px-6 py-3 font-semibold text-white hover:bg-boyd-orange-500"
      >
        Request a delivery in {area.city}
      </Link>
    </div>
  );
}
