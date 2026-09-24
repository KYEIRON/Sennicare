import 'server-only';

import { createAnthropicProvider } from './anthropic-provider';
import { unavailableAiProvider } from './unavailable-provider';
import type { AiProvider } from './provider';

/**
 * Select the AI provider.
 *
 * One decision, made here. With no key configured the unavailable adapter is
 * selected and every AI surface says so. There is no adapter that fabricates an
 * answer in a running application.
 */
export function getAiProvider(): AiProvider {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const provider = process.env.AI_PROVIDER;

  if (!apiKey || !model) return unavailableAiProvider;

  switch (provider) {
    case 'anthropic':
      return createAnthropicProvider(apiKey, model);
    default:
      // An unrecognised provider name is a configuration mistake. Failing to
      // "unavailable" is right: BOYD'S would rather say the AI is off than
      // guess which vendor was meant.
      return unavailableAiProvider;
  }
}

export type { AiProvider };

/** Whether BOYD'S AI is connected. Used to render the unavailable state. */
export function isAiConfigured(): boolean {
  return getAiProvider().available;
}
