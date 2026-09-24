/**
 * Running an AI conversation.
 *
 * The loop is deliberately bounded: a fixed number of tool rounds, a fixed
 * message cap, and a registry the model cannot step outside. An AI that can
 * call tools in an unbounded loop is an AI that can run up a bill or hammer the
 * database, and a public one is reachable by anybody.
 */

import 'server-only';

import { domainError, err, ok, type Result } from '@/lib/result';
import type { AiMessage, AiProvider } from './provider';
import {
  executeTool,
  toolDefinitions,
  type ToolContext,
  type ToolRegistry,
} from './tools/types';

/** How many times the model may call tools before it must answer. */
export const MAX_TOOL_ROUNDS = 4;

/** How long a single conversation may run. */
export const MAX_CONVERSATION_MESSAGES = 40;

export interface ConversationResult {
  readonly reply: string;
  readonly toolsUsed: readonly string[];
}

export async function runConversation(
  provider: AiProvider,
  options: {
    readonly system: string;
    readonly registry: ToolRegistry;
    readonly messages: readonly AiMessage[];
    readonly context: ToolContext;
  },
): Promise<Result<ConversationResult>> {
  if (!provider.available) {
    return err(
      domainError(
        'ai/unavailable',
        'BOYD’S AI is not connected. No AI provider is configured.',
      ),
    );
  }

  if (options.messages.length > MAX_CONVERSATION_MESSAGES) {
    return err(
      domainError(
        'ai/conversation-too-long',
        'This conversation has gone on long enough that it should reach a person. Please contact the BOYD’S team directly.',
      ),
    );
  }

  const tools = toolDefinitions(options.registry);
  const messages: AiMessage[] = [...options.messages];
  const toolsUsed: string[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const completion = await provider.complete({
      system: options.system,
      messages,
      tools,
    });

    if (!completion.ok) return completion;

    if (completion.value.toolCalls.length === 0) {
      return ok({ reply: completion.value.content, toolsUsed });
    }

    // The final round answers with whatever it has rather than calling again.
    if (round === MAX_TOOL_ROUNDS) {
      return ok({
        reply:
          completion.value.content ||
          'I could not find what you asked for. Please contact the BOYD’S team directly.',
        toolsUsed,
      });
    }

    for (const call of completion.value.toolCalls) {
      const outcome = await executeTool(
        options.registry,
        call.name,
        call.arguments,
        options.context,
      );

      toolsUsed.push(call.name);

      messages.push({
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: JSON.stringify(outcome.ok ? outcome.result : { error: outcome.error }),
      });
    }
  }

  return ok({
    reply:
      'I could not find what you asked for. Please contact the BOYD’S team directly.',
    toolsUsed,
  });
}
