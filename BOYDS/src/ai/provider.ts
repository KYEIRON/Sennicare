/**
 * The BOYD'S AI provider abstraction.
 *
 * No feature code names a vendor. BOYD'S is never architecturally dependent on
 * one AI provider, and swapping providers is a new adapter rather than a
 * rewrite.
 *
 * With no key configured the `unavailable` adapter is selected and the AI
 * surfaces say so plainly. Nothing simulates an answer.
 */

import type { Result } from '@/lib/result';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolName?: string;
}

export interface AiToolDefinition {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for the tool's arguments. */
  readonly parameters: Record<string, unknown>;
}

export interface AiToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface AiCompletion {
  readonly content: string;
  readonly toolCalls: readonly AiToolCall[];
}

export interface AiRequest {
  readonly system: string;
  readonly messages: readonly AiMessage[];
  readonly tools: readonly AiToolDefinition[];
  readonly maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  readonly available: boolean;
  complete(request: AiRequest): Promise<Result<AiCompletion>>;
}

/**
 * How confident BOYD'S is in a statement.
 *
 * Every AI answer is tagged. The distinction between a fact and an estimate is
 * the difference between a decision a partner can rely on and one they cannot,
 * so it is carried in the type rather than left to the wording.
 */
export const AI_CONFIDENCE = [
  'FACT',
  'ESTIMATE',
  'RECOMMENDATION',
  'DATA_INCOMPLETE',
] as const;

export type AiConfidence = (typeof AI_CONFIDENCE)[number];

export interface TaggedStatement {
  readonly confidence: AiConfidence;
  readonly text: string;
}

/**
 * Parse the confidence tags out of a reply.
 *
 * The model is instructed to prefix each statement. Anything it produces
 * without a tag is treated as `DATA_INCOMPLETE` rather than as fact — an
 * untagged claim is exactly the kind that should not be relied on.
 */
export function parseTaggedResponse(content: string): readonly TaggedStatement[] {
  const pattern = /^\s*(FACT|ESTIMATE|RECOMMENDATION|DATA INCOMPLETE)\s*:\s*/i;

  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const match = pattern.exec(block);
      if (!match) {
        return { confidence: 'DATA_INCOMPLETE' as const, text: block };
      }

      const tag = match[1]!.toUpperCase().replace(' ', '_') as AiConfidence;
      return { confidence: tag, text: block.replace(pattern, '').trim() };
    });
}
