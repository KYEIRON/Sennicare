import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy',
  description: "How BOYD'S Logistics LLC handles the information you give us.",
  alternates: { canonical: '/privacy' },
};

/**
 * Privacy.
 *
 * Describes what the software genuinely does with the information a visitor
 * provides — nothing more. It does not claim certifications, audits, or legal
 * frameworks BOYD'S has not verified holding. Ronald should have this reviewed
 * by a lawyer before the site goes live.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">Privacy</h1>

      <div className="mt-8 space-y-6 text-boyd-light-300">
        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">What we collect</h2>
          <p className="mt-2">
            When you send a delivery request, we record what you tell us: your name, your
            company if you give one, your email address or phone number, the collection
            and delivery addresses, and what needs moving. We do not ask for anything
            else, and we do not collect payment details on this site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">What we use it for</h2>
          <p className="mt-2">
            We use it to reply to you, to quote for the work, and — if you go ahead — to
            carry out the delivery and keep a record of it. We do not sell it, and we do
            not share it with anyone who is not involved in carrying out your delivery.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">
            How long we keep it
          </h2>
          <p className="mt-2">
            We keep records of the work we have done for you, including proof of delivery,
            for as long as we need them for our business and tax records.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-boyd-light-50">Asking us about it</h2>
          <p className="mt-2">
            If you want to know what we hold about you, or want it corrected or removed,
            send us a request and we will deal with it.
          </p>
        </section>
      </div>
    </div>
  );
}
