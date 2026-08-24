/**
 * Outbound SMS for BOYD'S.
 *
 * Same rule as email: with no provider configured, sending fails explicitly and
 * the message becomes a notification for a partner to handle. A driver alert
 * believed sent but never delivered is a job nobody turns up to.
 */

import { domainError, err, type Result } from '@/lib/result';

export interface SmsMessage {
  readonly to: string;
  readonly body: string;
}

export interface SmsProvider {
  readonly name: string;
  readonly available: boolean;
  send(message: SmsMessage): Promise<Result<{ readonly messageId: string }>>;
}

const UNAVAILABLE = domainError(
  'sms/unavailable',
  'No SMS provider is connected. The message was not sent.',
);

export const unavailableSms: SmsProvider = {
  name: 'unavailable',
  available: false,

  async send(): Promise<Result<{ messageId: string }>> {
    return err(UNAVAILABLE);
  },
};

export function getSms(): SmsProvider {
  const provider = process.env.SMS_PROVIDER;
  const apiKey = process.env.SMS_API_KEY;
  const from = process.env.SMS_FROM;

  if (!provider || !apiKey || !from) return unavailableSms;

  return unavailableSms;
}
