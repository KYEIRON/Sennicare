import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAiProvider } from '@/ai/registry';
import { runConversation } from '@/ai/conversation';
import { publicTools } from '@/ai/tools/public-tools';
import { internalTools } from '@/ai/tools/internal-tools';
import { RECEPTIONIST_PROMPT, INTERNAL_ASSISTANT_PROMPT } from '@/ai/prompts';
import { getServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { RATE_LIMITS, callerIdentifier, checkRateLimit } from '@/lib/rate-limit';

/**
 * The AI endpoint.
 *
 * The surface is decided HERE, on the server, from the caller's session — never
 * from anything the request body says. A public visitor gets the public
 * registry; a partner gets the internal one. There is no parameter a caller can
 * set to move themselves between them.
 */

const requestSchema = z.object({
  surface: z.enum(['PUBLIC', 'INTERNAL']),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(request: NextRequest) {
  // Each AI message costs BOYD'S money, and this endpoint is reachable by
  // anybody. The limit applies before any work is done.
  const limit = checkRateLimit(
    RATE_LIMITS.AI_MESSAGE,
    callerIdentifier(request.headers),
    'ai',
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          'That is a lot of messages in a short time. Please use the delivery request form, or contact the BOYD’S team directly.',
      },
      {
        status: 429,
        headers: {
          'retry-after': String(
            Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'That request could not be read.' },
      { status: 400 },
    );
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'BOYD’S AI is not connected.' }, { status: 503 });
  }

  const currentUser = await getCurrentUser();
  const isPartner =
    currentUser.ok &&
    (currentUser.value.role === 'PARTNER' || currentUser.value.role === 'ADMIN');

  // The internal assistant is for partners. A request asking for it without a
  // partner session quietly gets the public surface rather than an error —
  // there is nothing to learn from probing.
  const internal = parsed.data.surface === 'INTERNAL' && isPartner;

  const result = await runConversation(getAiProvider(), {
    system: internal ? INTERNAL_ASSISTANT_PROMPT : RECEPTIONIST_PROMPT,
    registry: internal ? internalTools : publicTools,
    messages: parsed.data.messages,
    context: {
      client: supabase,
      userId: currentUser.ok ? currentUser.value.id : null,
      role: currentUser.ok ? currentUser.value.role : null,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.code === 'ai/unavailable' ? 503 : 500 },
    );
  }

  return NextResponse.json({ reply: result.value.reply });
}
