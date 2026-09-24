import type { Metadata } from 'next';
import Link from 'next/link';
import { isAiConfigured } from '@/ai/registry';
import { ChatPanel } from '@/features/ai/chat-panel';

export const metadata: Metadata = {
  title: "Talk to BOYD'S AI",
  description:
    "Ask BOYD'S AI about services, service areas, or request a delivery. Available at any hour.",
  alternates: { canonical: '/ask' },
};

export default function AskPage() {
  const available = isAiConfigured();

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-boyd-light-50">Talk to BOYD&rsquo;S AI</h1>
      <p className="mt-4 text-boyd-light-300">
        Ask about what we do, where we cover, or tell us about a delivery you need.
      </p>

      <div className="mt-8">
        <ChatPanel
          surface="PUBLIC"
          available={available}
          greeting="Hi, I'm BOYD'S AI. I can help you request a delivery, get a quote, learn about our services, or connect with our team. How can I help?"
          placeholder="Tell me what you need moving"
          unavailableMessage={
            <>
              <p>BOYD&rsquo;S AI is not connected yet.</p>
              <p className="mt-2">
                The{' '}
                <Link
                  href="/request-a-delivery"
                  className="font-semibold text-boyd-blue-300 hover:underline"
                >
                  delivery request form
                </Link>{' '}
                works and reaches us straight away, at any hour.
              </p>
            </>
          }
        />
      </div>

      <p className="mt-6 text-sm text-boyd-light-500">
        BOYD&rsquo;S AI can record a request for you. It cannot quote a price, confirm a
        booking, or tell you when a van will arrive — a partner reviews every request
        before anything is agreed.
      </p>
    </div>
  );
}
