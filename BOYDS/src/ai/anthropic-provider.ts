/**
 * An AI provider adapter.
 *
 * Speaks the vendor's HTTP API directly rather than pulling in an SDK, so
 * BOYD'S carries no vendor dependency in its package tree and a second provider
 * is another file rather than another library.
 */

import 'server-only';

import { domainError, err, ok, type Result } from '@/lib/result';
import type { AiCompletion, AiProvider, AiRequest, AiToolCall } from './provider';

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export function createAnthropicProvider(
  apiKey: string,
  model: string,
  baseUrl = 'https://api.anthropic.com',
): AiProvider {
  return {
    name: 'anthropic',
    available: true,

    async complete(request: AiRequest): Promise<Result<AiCompletion>> {
      try {
        const response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: request.maxTokens ?? 1024,
            system: request.system,
            messages: request.messages
              .filter((message) => message.role !== 'system')
              .map((message) => ({ role: message.role, content: message.content })),
            tools: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters,
            })),
          }),
        });

        if (!response.ok) {
          // The provider's own error text may contain request details; it is
          // not passed through to the caller.
          return err(
            domainError('ai/request-failed', 'BOYD’S AI could not answer just now.', {
              status: response.status,
            }),
          );
        }

        const body = (await response.json()) as { content?: AnthropicContentBlock[] };
        const blocks = body.content ?? [];

        const text = blocks
          .filter((block) => block.type === 'text')
          .map((block) => block.text ?? '')
          .join('\n')
          .trim();

        const toolCalls: AiToolCall[] = blocks
          .filter((block) => block.type === 'tool_use' && block.id && block.name)
          .map((block) => ({
            id: block.id!,
            name: block.name!,
            arguments: block.input ?? {},
          }));

        return ok({ content: text, toolCalls });
      } catch {
        return err(
          domainError('ai/request-failed', 'BOYD’S AI could not be reached just now.'),
        );
      }
    },
  };
}
