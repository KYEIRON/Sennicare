import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms',
  description: "Terms on which BOYD'S Logistics LLC provides delivery services.",
  alternates: { canonical: '/terms' },
};

/**
 * Terms.
 *
 * Deliberately minimal and honest. It states the one thing this website most
 * needs to make clear — that a request is not an accepted job — and does not
 * invent liability limits, insurance levels or carriage conditions BOYD'S has
 * not agreed. Ronald should have proper terms drafted before trading at volume.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">Terms</h1>

      <div className="mt-8 space-y-6 text-boyd-light-300">
        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">
            A request is not an accepted job
          </h2>
          <p className="mt-2">
            Sending a request through this website tells us what you need. It does not
            create a booking. We will come back to you with what we can do and what it
            costs, and the job is agreed only when we have confirmed it with you directly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">Prices</h2>
          <p className="mt-2">
            We quote each job individually. A quote is valid for the period stated on it.
            Nothing on this website is a price or an offer.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">What we carry</h2>
          <p className="mt-2">
            Tell us what needs moving before we agree the job. Some items we will not
            carry, and we would rather say so at the outset than at the collection point.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">Timings</h2>
          <p className="mt-2">
            We agree timings with you for each job and we work to them. Where something
            outside our control affects a delivery — traffic, weather, access at either
            end — we tell you as soon as we know.
          </p>
        </section>
      </div>
    </div>
  );
}
