/**
 * The unavailable AI provider.
 *
 * Selected when no API key is configured. Every call fails explicitly, so the
 * interface renders an unavailable state. It never returns a plausible answer,
 * because a plausible answer from a disconnected AI is worse than no answer:
 * nobody would know to doubt it.
 */

import { domainError, err, type Result } from '@/lib/result';
import type { AiCompletion, AiProvider } from './provider';

export const unavailableAiProvider: AiProvider = {
  name: 'unavailable',
  available: false,

  async complete(): Promise<Result<AiCompletion>> {
    return err(
      domainError(
        'ai/unavailable',
        'BOYD’S AI is not connected. No AI provider API key is configured.',
      ),
    );
  },
};
