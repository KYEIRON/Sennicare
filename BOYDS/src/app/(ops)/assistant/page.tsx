import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '@/lib/auth/session';
import { isAiConfigured } from '@/ai/registry';
import { ChatPanel } from '@/features/ai/chat-panel';
import { Panel } from '@/components/ui/kpi-card';

export const metadata: Metadata = { title: 'BOYD’S AI' };

/** Questions the internal assistant can actually answer from BOYD'S data. */
const EXAMPLES = [
  'How did we perform this month?',
  'Which jobs lost money?',
  'What is our contribution per mile?',
  'Which customers are most profitable?',
  'Which quotes need following up?',
  'Where are we accumulating empty miles?',
  'What invoices are overdue?',
  'What should I investigate?',
];

export default async function AssistantPage() {
  const auth = await requirePartner();
  if (!auth.ok) return null;

  const available = isAiConfigured();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ChatPanel
          surface="INTERNAL"
          available={available}
          greeting={`Ask me about BOYD'S. I answer from the data in this system, and I tag every statement so you know what is a fact and what is not.`}
          placeholder="How did we perform this month?"
          unavailableMessage={
            <>
              <p>BOYD&rsquo;S AI is not connected.</p>
              <p className="mt-2">
                An AI provider API key is needed. Everything the assistant would read is
                already available on the{' '}
                <Link
                  href="/reports"
                  className="font-semibold text-boyd-blue-300 hover:underline"
                >
                  Reports
                </Link>{' '}
                screen in the meantime.
              </p>
            </>
          }
        />
      </div>

      <div className="space-y-4">
        <Panel title="What you can ask">
          <ul className="space-y-2 text-sm text-boyd-light-400">
            {EXAMPLES.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="How it answers">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-boyd-light-200">FACT</dt>
              <dd className="text-boyd-light-400">
                Read directly from BOYD&rsquo;S data.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-boyd-light-200">ESTIMATE</dt>
              <dd className="text-boyd-light-400">
                Derived, with the assumption stated.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-boyd-light-200">RECOMMENDATION</dt>
              <dd className="text-boyd-light-400">Its opinion, clearly labelled.</dd>
            </div>
            <div>
              <dt className="font-semibold text-boyd-light-200">DATA INCOMPLETE</dt>
              <dd className="text-boyd-light-400">
                The data needed does not exist yet — and it will tell you which jobs are
                missing what.
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-boyd-light-500">
            The assistant reads BOYD&rsquo;S data through a fixed set of tools. It has no
            direct database access and cannot see anything you could not see yourself.
          </p>
        </Panel>
      </div>
    </div>
  );
}
