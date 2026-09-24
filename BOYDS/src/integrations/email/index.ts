/**
 * Outbound email for BOYD'S.
 *
 * With no provider configured, sending FAILS and the message is queued as a
 * notification for a partner to send themselves. Nothing ever reports "sent"
 * when nothing was sent — an invoice believed delivered but never sent is money
 * BOYD'S waits for and does not chase.
 */

import { domainError, err, type Result } from '@/lib/result';

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly replyTo?: string;
}

export interface EmailProvider {
  readonly name: string;
  readonly available: boolean;
  send(message: EmailMessage): Promise<Result<{ readonly messageId: string }>>;
}

const UNAVAILABLE = domainError(
  'email/unavailable',
  'No email provider is connected. The message was not sent.',
);

export const unavailableEmail: EmailProvider = {
  name: 'unavailable',
  available: false,

  async send(): Promise<Result<{ messageId: string }>> {
    return err(UNAVAILABLE);
  },
};

export function getEmail(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER;
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!provider || !apiKey || !from) return unavailableEmail;

  // No live adapter yet. Unavailable is the honest answer.
  return unavailableEmail;
}
