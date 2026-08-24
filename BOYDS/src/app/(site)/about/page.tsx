import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    "BOYD'S Logistics LLC is a North Carolina business delivery company. Direct collection and delivery, one driver door to door.",
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">About BOYD&rsquo;S</h1>

      <div className="mt-6 space-y-5 text-boyd-light-300">
        <p>
          BOYD&rsquo;S Logistics LLC is a business delivery company based in North
          Carolina. We move things between businesses: parts, documents, samples, stock —
          the things that have to arrive.
        </p>
        <p>
          We are small, and we are direct about it. BOYD&rsquo;S runs one van. That is a
          real limit on how much we can take on in a day, and we would rather tell you
          that than take a job we cannot do well.
        </p>
        <p>
          It is also the reason our customers use us. Your delivery is collected and
          delivered by the same driver. It is not sorted at a depot, handed between
          couriers, or held overnight to fill a route. When you call, you reach someone
          who knows exactly where your delivery is.
        </p>
        <p>
          Every job is recorded properly: what moved, when it was collected, when it was
          delivered, who signed for it, and what it cost. That is partly for you, and
          partly because a business that does not measure its own work cannot improve it.
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-6">
        <h2 className="text-lg font-semibold text-boyd-light-50">Growing carefully</h2>
        <p className="mt-3 text-boyd-light-300">
          BOYD&rsquo;S intends to add vehicles and drivers. We will do it when the work
          supports it, not before — and we will not promise capacity we do not yet have.
        </p>
      </div>

      <Link
        href="/request-a-delivery"
        className="mt-10 inline-block rounded-md bg-boyd-orange-600 px-6 py-3 font-semibold text-white hover:bg-boyd-orange-500"
      >
        Request a delivery
      </Link>
    </div>
  );
}
