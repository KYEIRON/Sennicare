import type { Metadata } from 'next';
import { FAQ } from '@/features/site/content';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    "Common questions about BOYD'S Logistics: areas covered, pricing, collection times, proof of delivery and out-of-hours requests.",
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <h1 className="text-3xl font-bold text-boyd-light-50">Questions we get asked</h1>

      <dl className="mt-10 space-y-8">
        {FAQ.map((entry) => (
          <div key={entry.question}>
            <dt className="text-lg font-semibold text-boyd-light-50">{entry.question}</dt>
            <dd className="mt-2 text-boyd-light-300">{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
