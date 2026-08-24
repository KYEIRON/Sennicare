import type { Metadata } from 'next';
import { RequestForm } from './request-form';

export const metadata: Metadata = {
  title: 'Request a delivery',
  description:
    "Tell BOYD'S Logistics what needs moving, where from and where to. We come back to you with what we can do and what it costs.",
  alternates: { canonical: '/request-a-delivery' },
};

export default function RequestDeliveryPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">Request a delivery</h1>
      <p className="mt-4 text-boyd-light-300">
        Tell us what needs moving, where from and where to. We will come back to you with
        what we can do and what it will cost.
      </p>

      <div className="mt-6 rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-4">
        <p className="text-sm text-boyd-light-300">
          <span className="font-semibold text-boyd-light-100">
            This is a request, not a booking.
          </span>{' '}
          Send it at any hour — it reaches us straight away. Nothing is confirmed until we
          have replied and agreed it with you.
        </p>
      </div>

      <div className="mt-8">
        <RequestForm />
      </div>
    </div>
  );
}
