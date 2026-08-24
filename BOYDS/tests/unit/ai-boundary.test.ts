import { describe, expect, it, vi } from 'vitest';
import { executeTool, toolDefinitions, zodToJsonSchema } from '@/ai/tools/types';
import { publicTools } from '@/ai/tools/public-tools';
import { internalTools } from '@/ai/tools/internal-tools';
import { parseTaggedResponse } from '@/ai/provider';
import { unavailableAiProvider } from '@/ai/unavailable-provider';
import { runConversation, MAX_CONVERSATION_MESSAGES } from '@/ai/conversation';
import { INTERNAL_ASSISTANT_PROMPT, RECEPTIONIST_PROMPT } from '@/ai/prompts';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const ANONYMOUS = {
  client: {} as SupabaseClient,
  userId: null,
  role: null,
};

const PARTNER = {
  client: {} as SupabaseClient,
  userId: 'partner-1',
  role: 'PARTNER' as const,
};

describe('the public registry contains nothing internal', () => {
  it('has exactly the four public tools', () => {
    expect(Object.keys(publicTools).sort()).toEqual([
      'create_job_request',
      'get_faq',
      'get_service_areas',
      'get_services',
    ]);
  });

  it('contains NO internal tool — not denied, absent', () => {
    // A denied tool is something an attacker can probe for. An absent one is
    // not there to find.
    for (const name of Object.keys(internalTools)) {
      expect(publicTools[name]).toBeUndefined();
    }
  });

  it('exposes no tool that reads money, jobs or customers', () => {
    const names = Object.keys(publicTools).join(' ');
    for (const forbidden of [
      'profit',
      'invoice',
      'quote',
      'customer',
      'cost',
      'job_type',
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('marks every public tool as needing no role', () => {
    for (const tool of Object.values(publicTools)) {
      expect(tool.minimumRole).toBeNull();
    }
  });
});

describe('every internal tool requires a partner', () => {
  it.each(Object.keys(internalTools))('%s requires PARTNER', (name) => {
    expect(internalTools[name]!.minimumRole).toBe('PARTNER');
  });

  it('refuses an anonymous caller', async () => {
    for (const name of Object.keys(internalTools)) {
      const result = await executeTool(internalTools, name, {}, ANONYMOUS);
      expect(result.ok).toBe(false);
    }
  });

  it('refuses a driver', async () => {
    const driver = { ...ANONYMOUS, userId: 'driver-1', role: 'DRIVER' as const };

    for (const name of Object.keys(internalTools)) {
      const result = await executeTool(internalTools, name, {}, driver);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/not available on this surface/i);
    }
  });
});

describe('tool dispatch is closed', () => {
  it('refuses a tool that does not exist in this registry', async () => {
    const result = await executeTool(publicTools, 'get_profitability', {}, ANONYMOUS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no tool called/i);
  });

  it('refuses an invented tool name', async () => {
    const result = await executeTool(publicTools, 'drop_all_tables', {}, ANONYMOUS);
    expect(result.ok).toBe(false);
  });

  it('refuses arguments that do not match the schema', async () => {
    const result = await executeTool(
      publicTools,
      'create_job_request',
      { contactName: '', pickupAddress: '' },
      ANONYMOUS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid/i);
  });

  it('never surfaces an underlying error to the caller', async () => {
    const exploding = {
      boom: {
        name: 'boom',
        description: 'throws',
        schema: z.object({}),
        minimumRole: null,
        async execute() {
          throw new Error('SELECT * FROM users -- internal detail');
        },
      },
    } as never;

    const result = await executeTool(exploding, 'boom', {}, ANONYMOUS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain('SELECT');
      expect(result.error).not.toContain('users');
    }
  });
});

describe('tool schemas are usable by a model', () => {
  it('produces a JSON schema for every public tool', () => {
    const definitions = toolDefinitions(publicTools);
    expect(definitions).toHaveLength(4);

    for (const definition of definitions) {
      expect(definition.parameters).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
    }
  });

  it('produces a JSON schema for every internal tool', () => {
    expect(toolDefinitions(internalTools)).toHaveLength(
      Object.keys(internalTools).length,
    );
  });

  it('marks required fields as required', () => {
    const schema = zodToJsonSchema(
      z.object({ needed: z.string(), optional: z.string().optional() }),
    );
    expect(schema.required).toEqual(['needed']);
  });

  it('refuses a schema shape it cannot faithfully express', () => {
    // Emitting a schema that fails to constrain the model would be worse than
    // refusing: the model would send something the tool cannot handle.
    expect(() =>
      zodToJsonSchema(z.object({ nested: z.object({ a: z.string() }) })),
    ).toThrow();
  });
});

describe('the unavailable provider never fabricates', () => {
  it('fails explicitly rather than answering', async () => {
    const result = await unavailableAiProvider.complete({
      system: 'x',
      messages: [],
      tools: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/not connected/i);
  });

  it('stops a conversation before any tool runs', async () => {
    const result = await runConversation(unavailableAiProvider, {
      system: RECEPTIONIST_PROMPT,
      registry: publicTools,
      messages: [{ role: 'user', content: 'How much to Charlotte?' }],
      context: ANONYMOUS,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ai/unavailable');
  });
});

describe('the conversation loop is bounded', () => {
  it('refuses a conversation that has run too long', async () => {
    const provider = {
      name: 'test',
      available: true,
      complete: vi.fn(),
    };

    const messages = Array.from({ length: MAX_CONVERSATION_MESSAGES + 1 }, () => ({
      role: 'user' as const,
      content: 'hello',
    }));

    const result = await runConversation(provider, {
      system: 'x',
      registry: publicTools,
      messages,
      context: ANONYMOUS,
    });

    expect(result.ok).toBe(false);
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it('stops calling tools after the round limit', async () => {
    // A model that keeps calling tools forever would run up a bill and hammer
    // the database. It gets a fixed number of rounds and then must answer.
    const provider = {
      name: 'test',
      available: true,
      complete: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: '',
          toolCalls: [{ id: '1', name: 'get_services', arguments: {} }],
        },
      }),
    };

    const result = await runConversation(provider, {
      system: 'x',
      registry: publicTools,
      messages: [{ role: 'user', content: 'what do you do' }],
      context: ANONYMOUS,
    });

    expect(result.ok).toBe(true);
    expect(provider.complete.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('returns the answer once the model stops calling tools', async () => {
    const provider = {
      name: 'test',
      available: true,
      complete: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: 'We deliver across North Carolina.', toolCalls: [] },
      }),
    };

    const result = await runConversation(provider, {
      system: 'x',
      registry: publicTools,
      messages: [{ role: 'user', content: 'where do you deliver' }],
      context: PARTNER,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.reply).toContain('North Carolina');
  });
});

describe('confidence tagging', () => {
  it('reads the tag off each paragraph', () => {
    const parsed = parseTaggedResponse(
      'FACT: BOYD’S completed 24 jobs this month.\n\nESTIMATE: Contribution is approximately $3,400.\n\nRECOMMENDATION: Record the missing fuel costs.',
    );

    expect(parsed.map((p) => p.confidence)).toEqual([
      'FACT',
      'ESTIMATE',
      'RECOMMENDATION',
    ]);
    expect(parsed[0]!.text).toBe('BOYD’S completed 24 jobs this month.');
  });

  it('treats an UNTAGGED statement as DATA_INCOMPLETE, never as fact', () => {
    // An untagged claim is exactly the kind nobody should rely on.
    const parsed = parseTaggedResponse(
      'Contribution was about three and a half thousand.',
    );
    expect(parsed[0]!.confidence).toBe('DATA_INCOMPLETE');
  });

  it('reads DATA INCOMPLETE with its space', () => {
    const parsed = parseTaggedResponse(
      'DATA INCOMPLETE: three jobs are missing fuel costs.',
    );
    expect(parsed[0]!.confidence).toBe('DATA_INCOMPLETE');
  });
});

describe('the prompts state the rules that matter', () => {
  // The prompts are line-wrapped for readability, so assertions normalise
  // whitespace rather than depending on where a line happens to break.
  const receptionist = RECEPTIONIST_PROMPT.replace(/\s+/g, ' ');
  const internal = INTERNAL_ASSISTANT_PROMPT.replace(/\s+/g, ' ');

  it('tells the receptionist never to confirm a job', () => {
    expect(receptionist).toMatch(/received and will be reviewed/i);
    expect(receptionist).toMatch(/do not say it is booked/i);
  });

  it('tells the receptionist never to quote a price or an ETA', () => {
    expect(receptionist).toMatch(/never state/i);
    expect(receptionist).toMatch(/a price, a rate/i);
    expect(receptionist).toMatch(/when a delivery will arrive/i);
  });

  it('tells the receptionist to ask about recurring work', () => {
    expect(receptionist).toMatch(/one-time delivery or something you need regularly/i);
  });

  it('opens with the exact required greeting', () => {
    expect(receptionist).toContain(
      "Hi, I'm BOYD'S AI. I can help you request a delivery, get a quote, learn about our services, or connect with our team. How can I help?",
    );
  });

  it('requires the internal assistant to tag every statement', () => {
    for (const tag of ['FACT:', 'ESTIMATE:', 'RECOMMENDATION:', 'DATA INCOMPLETE:']) {
      expect(internal).toContain(tag);
    }
  });

  it('tells the internal assistant not to fill gaps with industry averages', () => {
    expect(internal).toMatch(/never fill a gap with an industry average/i);
    expect(internal).toMatch(/NOT CONFIGURED/);
  });

  it('states that an unmeasured job is not a profitable one', () => {
    expect(internal).toMatch(/unmeasured one/i);
  });
});
