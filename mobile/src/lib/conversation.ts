import { DiscoveryResult, UserContext, discover, planDay, DayPlan } from './discovery';
import { EMPTY_INTENT, Intent, describeIntent, parseIntent, refineIntent } from './intent';

/**
 * Ask Nourish.
 *
 * The conversation holds the last intent, so a follow-up refines the answer
 * already on screen rather than starting again. "I want more fish" → "which
 * ones use what I have?" → "make them lunches" → "nothing spicy" is one
 * narrowing thread, not four unrelated searches.
 *
 * It is not a chatbot: every turn returns structured Nourish data — records,
 * reasons, a pantry split, a safety note — and the wording is assembled from
 * that data rather than generated.
 */
export type TurnKind = 'find' | 'plan' | 'culture' | 'nutrition' | 'pantry' | 'empty';

export type Turn = {
  intent: Intent;
  kind: TurnKind;
  /** One or two sentences describing the approach taken. */
  intro: string;
  /** What Nourish understood, shown back so it can be corrected. */
  understood: string;
  result: DiscoveryResult;
  plan?: DayPlan;
  /** Safety wording, when the profile carries allergies. */
  safety?: string;
  /** Follow-ups worth offering, given what was just asked. */
  suggestions: string[];
};

function introFor(intent: Intent, result: DiscoveryResult): string {
  const places = result.countriesRepresented.length;

  if (intent.kind === 'plan') {
    return 'I have shaped the day around variety and practicality rather than picking three recipes at random. Breakfast, lunch and dinner are chosen together.';
  }
  if (intent.kind === 'culture') {
    return 'I can tell you what Nourish holds about a dish and its food culture. Where a record is only a dish reference rather than a verified history, I will say so instead of filling the gap.';
  }
  if (intent.kind === 'nutrition') {
    return 'I can explain what a meal brings in general terms, using the nutrition Nourish holds. I will not turn that into medical advice.';
  }
  if (!result.recipes.length && !result.discoveries.length) {
    if (result.unrecognised.length) {
      return `I do not have anything for ${result.unrecognised.join(', ')} in the Nourish food library. I would rather tell you that than answer a different question.`;
    }
    return 'I could not find a match I would stand behind. I would rather ask you to adjust the request than invent a dish or a recipe.';
  }
  if (result.relaxed.length) {
    return `Nothing matched all of that, so I loosened ${result.relaxed.join(' and ')} and kept the rest. ${places} food cultures here.`;
  }
  if (intent.wantsPantry) {
    return `Starting with what is already in your kitchen, then keeping the extra shopping small. ${places} food cultures in this shortlist.`;
  }
  if (intent.wantsNovelty) {
    return `Somewhere you have not been yet — without making the ingredients hard to find. ${places} places to consider.`;
  }
  if (intent.countries.length) {
    return `Here is what Nourish holds for ${intent.countries.slice(0, 2).join(' and ')}, recipes first and then dishes worth exploring.`;
  }
  if (intent.places.length) {
    return `Looking across ${intent.places.slice(0, 2).join(' and ')} rather than one country: ${places} food cultures here.`;
  }
  return `I searched the whole Nourish food library, not just the featured screen — ${places} food cultures in this shortlist.`;
}

function safetyFor(result: DiscoveryResult): string | undefined {
  if (!result.allergens.length) return undefined;
  const list = result.allergens.join(', ');
  const flagged = result.discoveries.length
    ? ' Dishes from the country atlas have no verified ingredient list, so they are shown as discovery records rather than as safe options.'
    : '';
  return `Allergy check: I removed ${result.excludedForAllergies} records that Nourish knows or suspects contain ${list}.${flagged} Packaged products and preparation still need checking — Nourish cannot tell you a dish is safe.`;
}

function suggestionsFor(intent: Intent, result: DiscoveryResult): string[] {
  const out: string[] = [];
  if (!intent.wantsPantry) out.push('Which of those use what I have?');
  if (!intent.maxMinutes) out.push('Only the quick ones');
  if (!intent.slots.length) out.push('Make them lunches');
  if (!intent.wantsNovelty) out.push('Take me somewhere new');
  if (result.discoveries.length) {
    out.push(`Tell me about ${result.discoveries[0].record.title}`);
  }
  if (intent.kind !== 'plan') out.push('Plan tomorrow');
  return out.slice(0, 4);
}

export class Conversation {
  private lastIntent: Intent = EMPTY_INTENT;
  private turns: Turn[] = [];

  get history(): Turn[] {
    return this.turns;
  }

  reset() {
    this.lastIntent = EMPTY_INTENT;
    this.turns = [];
  }

  ask(query: string, context: UserContext): Turn {
    const hasHistory = this.turns.length > 0;
    const intent = hasHistory ? refineIntent(this.lastIntent, query) : parseIntent(query);
    this.lastIntent = intent;

    const limit = intent.count ?? (intent.kind === 'plan' ? 3 : 6);
    const result = discover(intent, context, { limit, discoveryLimit: Math.max(6, limit) });
    const plan = intent.kind === 'plan' ? planDay(context, intent.raw) : undefined;

    const turn: Turn = {
      intent,
      kind: result.recipes.length || result.discoveries.length || plan ? intent.kind : 'empty',
      intro: introFor(intent, result),
      understood: describeIntent(intent),
      result,
      plan,
      safety: safetyFor(result),
      suggestions: suggestionsFor(intent, result),
    };

    this.turns.push(turn);
    return turn;
  }
}

/** A single question with no conversation around it. */
export function askOnce(query: string, context: UserContext): Turn {
  return new Conversation().ask(query, context);
}
