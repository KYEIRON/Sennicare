/**
 * The AI tool layer.
 *
 * THE AI NEVER TOUCHES THE DATABASE.
 *
 * It sees a registry of named tools. Each declares a Zod input schema and the
 * minimum role required, runs an authorised repository call, and returns
 * permission-filtered data. There is no tool that accepts SQL, no tool that
 * takes a table name, and no tool that returns a row the caller could not have
 * read themselves.
 *
 * The public receptionist is constructed with the public registry only.
 * Internal tools are not merely denied to it — they are absent, so no prompt
 * can reach them. That distinction matters: a denied tool is something an
 * attacker can probe for, and an absent one is not there to find.
 *
 * See docs/AI.md and docs/DECISIONS.md D-023.
 */

import type { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/types/auth';
import type { AiToolDefinition } from '../provider';

export interface ToolContext {
  readonly client: SupabaseClient;
  /** Null for an anonymous website visitor. */
  readonly userId: string | null;
  readonly role: UserRole | null;
}

export interface AiTool<TInput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType<TInput>;
  /** Null means the tool is public. */
  readonly minimumRole: 'PARTNER' | null;
  execute(input: TInput, context: ToolContext): Promise<unknown>;
}

export type ToolRegistry = Readonly<Record<string, AiTool<never>>>;

/** Convert a registry into the definitions the provider is given. */
export function toolDefinitions(registry: ToolRegistry): readonly AiToolDefinition[] {
  return Object.values(registry).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  }));
}

/**
 * A minimal Zod-to-JSON-Schema conversion.
 *
 * BOYD'S tool inputs are deliberately simple — a handful of strings, numbers
 * and enums — so this covers them without adding a dependency. It throws on
 * anything it does not understand rather than emitting a schema that silently
 * fails to constrain the model.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const definition = (schema as unknown as { def: { type: string; shape?: unknown } })
    .def;

  if (definition?.type !== 'object') {
    throw new Error('An AI tool input must be an object schema.');
  }

  const shape = (schema as unknown as { shape: Record<string, z.ZodType> }).shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const inner = (value as unknown as { def: { type: string; values?: string[] } }).def;
    const optional = inner.type === 'optional' || inner.type === 'nullable';

    const target = optional
      ? ((value as unknown as { def: { innerType: z.ZodType } }).def
          .innerType as unknown as {
          def: { type: string; values?: string[] };
        })
      : (value as unknown as { def: { type: string; values?: string[] } });

    properties[key] = jsonTypeOf(target.def.type, target.def.values);
    if (!optional) required.push(key);
  }

  return { type: 'object', properties, required, additionalProperties: false };
}

function jsonTypeOf(type: string, values?: string[]): Record<string, unknown> {
  switch (type) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'enum':
      return { type: 'string', enum: values ?? [] };
    default:
      throw new Error(`AI tool inputs do not support the "${type}" type.`);
  }
}

export const TOOL_ERRORS = {
  UNKNOWN_TOOL: 'ai/unknown-tool',
  FORBIDDEN: 'ai/tool-forbidden',
  INVALID_INPUT: 'ai/tool-invalid-input',
} as const;

/**
 * Run a tool call.
 *
 * Every call passes three checks before it touches anything: the tool exists in
 * THIS registry, the caller's role clears its minimum, and the arguments parse
 * against its schema. A model that hallucinates a tool name, or invents an
 * argument, gets an error rather than an effect.
 */
export async function executeTool(
  registry: ToolRegistry,
  name: string,
  args: unknown,
  context: ToolContext,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const tool = registry[name];

  if (!tool) {
    return { ok: false, error: `There is no tool called "${name}".` };
  }

  if (
    tool.minimumRole === 'PARTNER' &&
    context.role !== 'PARTNER' &&
    context.role !== 'ADMIN'
  ) {
    return { ok: false, error: 'That information is not available on this surface.' };
  }

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Those arguments are not valid: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    };
  }

  try {
    const result = await tool.execute(parsed.data as never, context);
    return { ok: true, result };
  } catch {
    return { ok: false, error: 'That information could not be retrieved.' };
  }
}
