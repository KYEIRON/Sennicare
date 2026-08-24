'use client';

import { useState } from 'react';

/**
 * The shared chat interface.
 *
 * Used by both the public receptionist and the internal assistant. When BOYD'S
 * AI is not connected it says so plainly and points at the route that does
 * work, rather than presenting an input box that goes nowhere.
 */

interface Message {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export function ChatPanel({
  surface,
  greeting,
  placeholder,
  available,
  unavailableMessage,
}: Readonly<{
  surface: 'PUBLIC' | 'INTERNAL';
  greeting: string;
  placeholder: string;
  available: boolean;
  unavailableMessage: React.ReactNode;
}>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return (
      <div className="rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-6">
        <span className="inline-flex items-center rounded border border-boyd-unavailable/40 bg-boyd-unavailable/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-boyd-light-400">
          UNAVAILABLE
        </span>
        <div className="mt-3 text-sm text-boyd-light-300">{unavailableMessage}</div>
      </div>
    );
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();

    const text = input.trim();
    if (!text || pending) return;

    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ surface, messages: next }),
      });

      const body = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !body.reply) {
        setError(body.error ?? 'BOYD’S AI could not answer just now.');
        return;
      }

      setMessages([...next, { role: 'assistant', content: body.reply }]);
    } catch {
      setError('BOYD’S AI could not be reached just now.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-boyd-navy-700 bg-boyd-navy-900">
      <div
        className="min-h-64 flex-1 space-y-4 overflow-y-auto p-5"
        role="log"
        aria-live="polite"
      >
        <p className="text-boyd-light-300">{greeting}</p>

        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-lg bg-boyd-blue-600/20 p-3 text-sm text-boyd-light-100'
                : 'max-w-[85%] text-sm whitespace-pre-wrap text-boyd-light-300'
            }
          >
            {message.content}
          </div>
        ))}

        {pending && <p className="text-sm text-boyd-light-500">Thinking&hellip;</p>}
        {error && (
          <p role="alert" className="text-sm text-boyd-negative">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-boyd-navy-800 p-3">
        <label htmlFor="ai-input" className="sr-only">
          Your message
        </label>
        <input
          id="ai-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          maxLength={4000}
          disabled={pending}
          className="flex-1 rounded-md border border-boyd-navy-700 bg-boyd-navy-950 px-3 py-2.5 text-boyd-light-100 placeholder:text-boyd-light-600 focus:border-boyd-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || input.trim().length === 0}
          className="rounded-md bg-boyd-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-boyd-blue-500 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
