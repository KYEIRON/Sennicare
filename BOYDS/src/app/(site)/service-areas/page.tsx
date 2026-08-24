import type { Metadata } from 'next';
import Link from 'next/link';
import { SERVICE_AREAS } from '@/features/site/content';

export const metadata: Metadata = {
  title: 'Service areas',
  description:
    "Where BOYD'S Logistics delivers: Charlotte, Concord, Greensboro, Winston-Salem, Raleigh, Durham, Fayetteville and across North Carolina.",
  alternates: { canonical: '/service-areas' },
};

export default function ServiceAreasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">
        Where BOYD&rsquo;S delivers
      </h1>
      <p className="mt-4 max-w-2xl text-boyd-light-300">
        BOYD&rsquo;S Logistics is based in North Carolina and serves businesses across the
        state. We also take work into neighbouring states. These are service areas we
        cover — not office locations.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SERVICE_AREAS.map((area) => (
          <Link
            key={area.slug}
            href={`/service-areas/${area.slug}`}
            className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-5 transition-colors hover:border-boyd-blue-500"
          >
            <h2 className="font-semibold text-boyd-light-50">
              {area.city}, {area.state}
            </h2>
            <p className="mt-2 text-sm text-boyd-light-400">{area.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
