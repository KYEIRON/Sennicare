import { continentFor } from './data';
import {
  Difficulty, FoodRecord, allergensFromIngredients, foodGraph, ingredientKey, recipeRecords,
} from './foodGraph';
import { Intent, hasSubject, parseIntent } from './intent';
import { Allergen, ALLERGEN_KEYWORDS, MealSlot, MEAL_SLOTS } from './taxonomy';

/**
 * The Girki recommendation engine.
 *
 * Retrieval runs over the whole food graph — 30 recipes and 585 dishes from the
 * 195-country atlas — never over the featured rail. Ranking then balances
 * relevance against pantry fit, practicality, novelty and, deliberately,
 * cultural diversity, so eight fish ideas come from eight food cultures rather
 * than eight versions of salmon.
 */

export type UserContext = {
  allergies: string[];
  diet?: string;
  priorities: string[];
  pantry: string[];
  plus: boolean;
  /** Countries the person has already opened. */
  exploredCountries: string[];
  /** Meal indices recently cooked or planned. */
  recentMeals: number[];
  rejectedMeals: number[];
};

export const EMPTY_CONTEXT: UserContext = {
  allergies: [],
  diet: undefined,
  priorities: [],
  pantry: [],
  plus: false,
  exploredCountries: [],
  recentMeals: [],
  rejectedMeals: [],
};

export type ReasonKind =
  | 'match'
  | 'pantry'
  | 'time'
  | 'difficulty'
  | 'discovery'
  | 'variety'
  | 'shopping'
  | 'preference';

/** One line of "Why this?". */
export type Reason = { kind: ReasonKind; label: string; detail: string };

export type Recommendation = {
  record: FoodRecord;
  score: number;
  reasons: Reason[];
  /** Pantry ingredients this recipe already uses, and what is still needed. */
  have: string[];
  need: string[];
  /** Allergens Girki knows this record contains. */
  containsAllergens: Allergen[];
  /** True when Girki has no ingredient list, so nothing can be ruled out. */
  allergenUnknown: boolean;
};

const WEIGHTS = {
  ingredient: 14,
  tag: 12,
  slot: 10,
  country: 30,
  place: 16,
  pantryItem: 6,
  shopping: 8,
  time: 10,
  difficulty: 8,
  novelty: 9,
  preference: 6,
  recipeBacked: 5,
  recentPenalty: -14,
  rejectedPenalty: -40,
};

/** An allergy name from the profile, normalised to a graph allergen. */
function toAllergen(value: string): Allergen | undefined {
  const v = value.trim().toLowerCase();
  const found = (Object.keys(ALLERGEN_KEYWORDS) as Allergen[]).find((a) => a.toLowerCase() === v);
  if (found) return found;
  if (v === 'nuts') return 'Tree nuts';
  if (v === 'gluten') return 'Wheat';
  if (v === 'dairy') return 'Milk';
  return undefined;
}

export function userAllergens(context: UserContext): Allergen[] {
  return context.allergies
    .filter((a) => a && a !== 'None')
    .map(toAllergen)
    .filter((a): a is Allergen => Boolean(a));
}

/**
 * Safety filter.
 *
 * A recipe with a known allergen is removed. A discovery record whose *name*
 * hints at the allergen is also removed — suspicion is enough to exclude. What
 * is never done is the opposite: no record is ever marked safe, because a dish
 * name is not an ingredient list.
 */
export function passesAllergyFilter(record: FoodRecord, allergens: Allergen[]): boolean {
  if (!allergens.length) return true;
  return !record.allergens.some((a) => allergens.includes(a));
}

/** Diet preferences are preferences, not safety — they rank, they don't remove. */
function dietPenalty(record: FoodRecord, diet?: string): number {
  if (!diet) return 0;
  const animal = record.tags.some((t) => t === 'meat' || t === 'chicken' || t === 'fish' || t === 'shellfish');
  if (/vegan|vegetarian/i.test(diet) && animal) return -22;
  if (/pescatarian/i.test(diet) && record.tags.some((t) => t === 'meat' || t === 'chicken')) return -18;
  if (/mostly plant based/i.test(diet) && animal) return -5;
  return 0;
}

function pantryOverlap(record: FoodRecord, pantry: string[]): { have: string[]; need: string[] } {
  const pantryKeys = pantry.map(ingredientKey).filter(Boolean);
  const matches = (ingredient: string) => {
    const base = ingredientKey(ingredient);
    return pantryKeys.some(
      (p) => p && (base.includes(p) || p.includes(base)) && base.length > 2 && p.length > 2
    );
  };

  if (record.kind === 'recipe') {
    return {
      have: record.ingredients.filter(matches),
      need: record.ingredients.filter((i) => !matches(i)),
    };
  }

  // A discovery record has implied ingredients only; report the overlap as
  // interest, never as a shopping list.
  return { have: record.ingredientKeys.filter(matches), need: [] };
}

/**
 * Hard constraints.
 *
 * Scores alone let a record accumulate points from pantry overlap or novelty
 * and appear in an answer it does not belong to — "I want more fish" returning
 * chicken phở because the pantry matched. Anything the person actually named is
 * a requirement, not a preference: subject, meal slot, place and time budget.
 */
function meetsRequirements(record: FoodRecord, intent: Intent): boolean {
  const haystack = `${record.title} ${record.ingredientKeys.join(' ')} ${record.ingredients.join(' ')}`.toLowerCase();

  // Subject: at least one named tag or ingredient must be present.
  if (intent.tags.length || intent.ingredients.length) {
    const tagHit = intent.tags.some((tag) => record.tags.includes(tag));
    const ingredientHit = intent.ingredients.some((word) =>
      new RegExp(`\\b${word}s?\\b`).test(haystack)
    );
    if (!tagHit && !ingredientHit) return false;
  }

  if (intent.slots.length && !intent.slots.some((slot) => record.slots.includes(slot))) return false;

  if (intent.countries.length && !intent.countries.includes(record.country)) return false;

  if (intent.places.length) {
    const region = record.region.toLowerCase();
    const hit = intent.places.some(
      (place) => record.continent === place || region.includes(place.toLowerCase())
    );
    if (!hit) return false;
  }

  // A time budget applies to records that have a time. A discovery record has
  // none, so it stays as an idea rather than being silently dropped.
  if (intent.maxMinutes && record.minutes !== undefined && record.minutes > intent.maxMinutes) {
    return false;
  }

  return true;
}

function excluded(record: FoodRecord, intent: Intent): boolean {
  if (intent.excludeTags.some((tag) => record.tags.includes(tag))) return true;
  if (intent.excludeIngredients.length) {
    const text = `${record.title} ${record.ingredients.join(' ')} ${record.ingredientKeys.join(' ')}`.toLowerCase();
    if (intent.excludeIngredients.some((word) => new RegExp(`\\b${word}s?\\b`).test(text))) return true;
  }
  return false;
}

/** Does this record answer any part of what was asked? */
function relevance(record: FoodRecord, intent: Intent): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let score = 0;
  const title = record.title.toLowerCase();
  const haystack = `${title} ${record.ingredientKeys.join(' ')} ${record.tags.join(' ')}`;

  const matchedIngredients = intent.ingredients.filter((word) =>
    new RegExp(`\\b${word}s?\\b`).test(haystack)
  );
  if (matchedIngredients.length) {
    score += WEIGHTS.ingredient * matchedIngredients.length;
    reasons.push({
      kind: 'match',
      label: 'What you asked for',
      detail: `Uses ${matchedIngredients.slice(0, 3).join(', ')}.`,
    });
  }

  const matchedTags = intent.tags.filter((tag) => record.tags.includes(tag));
  if (matchedTags.length) {
    score += WEIGHTS.tag * matchedTags.length;
    if (!matchedIngredients.length) {
      reasons.push({
        kind: 'match',
        label: 'What you asked for',
        detail: `${matchedTags.slice(0, 3).join(', ')}.`,
      });
    }
  }

  if (intent.slots.length) {
    if (intent.slots.some((slot) => record.slots.includes(slot))) {
      score += WEIGHTS.slot;
    } else {
      score -= WEIGHTS.slot;
    }
  }

  if (intent.countries.length) {
    if (intent.countries.includes(record.country)) {
      score += WEIGHTS.country;
      reasons.push({ kind: 'match', label: 'Where you asked about', detail: record.country });
    } else {
      score -= 8;
    }
  }

  if (intent.places.length) {
    const region = record.region.toLowerCase();
    const continent = record.continent;
    const hit = intent.places.some(
      (place) => continent === place || region.includes(place.toLowerCase())
    );
    if (hit) {
      score += WEIGHTS.place;
      reasons.push({
        kind: 'match',
        label: 'Where you asked about',
        detail: `${record.country} · ${record.region}`,
      });
    } else {
      score -= 10;
    }
  }

  // A query with no structure at all still deserves an answer: fall back to a
  // plain text match over the title.
  if (!intent.ingredients.length && !intent.tags.length && !intent.countries.length && !intent.places.length) {
    const words = intent.raw.toLowerCase().split(/[^a-zà-ÿ]+/).filter((w) => w.length > 3);
    const hits = words.filter((w) => haystack.includes(w)).length;
    if (hits) score += hits * 6;
  }

  return { score, reasons };
}

function practicality(record: FoodRecord, intent: Intent): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let score = 0;

  if (intent.maxMinutes && record.minutes !== undefined) {
    if (record.minutes <= intent.maxMinutes) {
      score += WEIGHTS.time;
      reasons.push({ kind: 'time', label: 'Time', detail: `${record.minutes} minutes.` });
    } else {
      score -= WEIGHTS.time * 2;
    }
  } else if (intent.maxMinutes && record.minutes === undefined) {
    score -= 4;
  } else if (record.minutes !== undefined && record.minutes <= 25) {
    score += 3;
  }

  if (intent.difficulty && record.difficulty) {
    if (record.difficulty === intent.difficulty) {
      score += WEIGHTS.difficulty;
      reasons.push({ kind: 'difficulty', label: 'Effort', detail: `${record.difficulty} to make.` });
    } else if (intent.difficulty === 'easy' && record.difficulty === 'involved') {
      score -= WEIGHTS.difficulty;
    }
  }

  if (record.kind === 'recipe') score += WEIGHTS.recipeBacked;
  return { score, reasons };
}

function personal(
  record: FoodRecord,
  context: UserContext,
  intent: Intent
): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let score = dietPenalty(record, context.diet);

  const { have, need } = pantryOverlap(record, context.pantry);
  if (have.length) {
    score += WEIGHTS.pantryItem * have.length * (intent.wantsPantry ? 2 : 1);
    if (record.kind === 'recipe') {
      reasons.push({
        kind: 'pantry',
        label: 'Pantry',
        detail:
          need.length === 0
            ? 'You already have everything for this.'
            : `Uses ${have.length} of ${record.ingredients.length} things you already have.`,
      });
      if (need.length) {
        reasons.push({
          kind: 'shopping',
          label: 'Shopping',
          detail: `You would need ${need.length}: ${need.slice(0, 3).map(ingredientKey).join(', ')}.`,
        });
      }
    } else {
      reasons.push({
        kind: 'pantry',
        label: 'Pantry',
        detail: `Built around ${have.slice(0, 3).join(', ')}, which you have.`,
      });
    }
  }

  if (record.kind === 'recipe' && need.length && need.length <= 2) {
    score += WEIGHTS.shopping;
  }

  // Priorities nudge, they never dictate.
  for (const priority of context.priorities) {
    if (/plants/i.test(priority) && record.tags.includes('plant based')) score += WEIGHTS.preference;
    if (/easier meals/i.test(priority) && record.difficulty === 'easy') score += WEIGHTS.preference;
    if (/variety/i.test(priority) && !context.exploredCountries.includes(record.country)) score += 3;
    if (/heart|healthy ageing|everyday health/i.test(priority) && record.tags.includes('fish')) score += 3;
    if (/digestive/i.test(priority) && record.tags.includes('high fibre')) score += 3;
  }

  const unexplored = !context.exploredCountries.includes(record.country);
  if (intent.wantsNovelty) {
    if (unexplored) {
      score += WEIGHTS.novelty * 2;
      reasons.push({
        kind: 'discovery',
        label: 'Discovery',
        detail: `Somewhere you have not explored yet: ${record.country}.`,
      });
    } else {
      score -= WEIGHTS.novelty;
    }
  } else if (unexplored) {
    score += 2;
  }

  if (record.mealIndex !== undefined) {
    if (context.rejectedMeals.includes(record.mealIndex)) score += WEIGHTS.rejectedPenalty;
    if (context.recentMeals.includes(record.mealIndex)) score += WEIGHTS.recentPenalty;
  }

  return { score, reasons };
}

function buildRecommendation(
  record: FoodRecord,
  intent: Intent,
  context: UserContext,
  allergens: Allergen[]
): Recommendation {
  const r = relevance(record, intent);
  const p = practicality(record, intent);
  const u = personal(record, context, intent);
  const { have, need } = pantryOverlap(record, context.pantry);

  return {
    record,
    score: r.score + p.score + u.score,
    reasons: [...r.reasons, ...p.reasons, ...u.reasons],
    have,
    need,
    containsAllergens: record.allergens,
    allergenUnknown: record.kind === 'discovery' && allergens.length > 0,
  };
}

/**
 * Cultural diversity.
 *
 * Ranking by score alone returns the same food culture repeatedly. This walks
 * the ranked list and takes the best remaining record from a country that has
 * not been used yet, allowing a second dish from a country only once every
 * country in the pool has had a turn.
 */
const MAX_PER_COUNTRY = 2;

function diversify(ranked: Recommendation[], limit: number): Recommendation[] {
  const chosen: Recommendation[] = [];
  const used = new Map<string, number>();
  let round = 0;

  // Two rounds: every food culture gets a turn before any gets a second, and
  // none gets a third. A shorter, varied answer beats a long, repetitive one.
  while (chosen.length < limit && round < MAX_PER_COUNTRY) {
    for (const candidate of ranked) {
      if (chosen.length >= limit) break;
      if (chosen.includes(candidate)) continue;
      if ((used.get(candidate.record.country) || 0) > round) continue;
      chosen.push(candidate);
      used.set(candidate.record.country, (used.get(candidate.record.country) || 0) + 1);
    }
    round += 1;
  }
  return chosen;
}

export type DiscoveryResult = {
  intent: Intent;
  /** Recipe-backed matches: these can be cooked. */
  recipes: Recommendation[];
  /** Dishes from the country atlas: these can be explored. */
  discoveries: Recommendation[];
  /** How many records the safety filter removed. */
  excludedForAllergies: number;
  allergens: Allergen[];
  countriesRepresented: string[];
  /** Constraints Girki had to loosen to find anything, in plain words. */
  relaxed: string[];
  /** Words from the request that exist nowhere in the food library. */
  unrecognised: string[];
};

/**
 * When a fully constrained search finds nothing, loosen the least important
 * constraint and say so — "no Japanese breakfast dishes yet, here is Japanese
 * food more broadly" — rather than showing an empty screen. The subject and the
 * place are never relaxed: those are what was actually asked for.
 */
const RELAXATIONS: { label: string; apply: (intent: Intent) => Intent }[] = [
  { label: 'the meal type', apply: (i) => ({ ...i, slots: [] }) },
  { label: 'the time limit', apply: (i) => ({ ...i, maxMinutes: undefined }) },
  { label: 'the effort level', apply: (i) => ({ ...i, difficulty: undefined }) },
];

function collect(
  intent: Intent,
  context: UserContext,
  allergens: Allergen[]
): { candidates: Recommendation[]; excludedForAllergies: number } {
  let excludedForAllergies = 0;
  const candidates: Recommendation[] = [];

  for (const record of foodGraph) {
    if (!passesAllergyFilter(record, allergens)) {
      excludedForAllergies += 1;
      continue;
    }
    if (excluded(record, intent)) continue;
    if (!meetsRequirements(record, intent)) continue;
    const recommendation = buildRecommendation(record, intent, context, allergens);
    if (recommendation.score > 0) candidates.push(recommendation);
  }

  candidates.sort((a, b) => b.score - a.score);
  return { candidates, excludedForAllergies };
}

export function discover(
  query: string | Intent,
  context: UserContext = EMPTY_CONTEXT,
  options: { limit?: number; discoveryLimit?: number } = {}
): DiscoveryResult {
  const intent = typeof query === 'string' ? parseIntent(query) : query;
  const allergens = userAllergens(context);
  const limit = options.limit ?? intent.count ?? 6;
  const discoveryLimit = options.discoveryLimit ?? Math.max(6, limit);

  const empty: DiscoveryResult = {
    intent,
    recipes: [],
    discoveries: [],
    excludedForAllergies: 0,
    allergens,
    countriesRepresented: [],
    relaxed: [],
    unrecognised: intent.unknownTerms,
  };

  // A request built entirely on words Girki has never seen is not answered by
  // quietly serving the one word it did recognise.
  if (intent.unknownTerms.length && !hasSubject(intent)) return empty;

  let { candidates, excludedForAllergies } = collect(intent, context, allergens);
  const relaxed: string[] = [];
  let working = intent;

  for (const relaxation of RELAXATIONS) {
    if (candidates.length) break;
    const loosened = relaxation.apply(working);
    if (JSON.stringify(loosened) === JSON.stringify(working)) continue;
    working = loosened;
    relaxed.push(relaxation.label);
    ({ candidates, excludedForAllergies } = collect(working, context, allergens));
  }

  const recipes = diversify(candidates.filter((c) => c.record.kind === 'recipe'), limit);
  const discoveries = diversify(candidates.filter((c) => c.record.kind === 'discovery'), discoveryLimit);

  return {
    intent,
    recipes,
    discoveries,
    excludedForAllergies,
    allergens,
    countriesRepresented: [...new Set([...recipes, ...discoveries].map((r) => r.record.country))],
    relaxed: candidates.length ? relaxed : [],
    unrecognised: intent.unknownTerms,
  };
}

/**
 * A whole day, planned together rather than three separate lookups: variety
 * across food cultures, pantry reuse carried between meals, and the time budget
 * spent where it matters.
 */
export type DayPlan = {
  slots: { slot: MealSlot; recommendation?: Recommendation }[];
  pantryUsed: string[];
  shoppingNeeded: string[];
  countries: string[];
};

export function planDay(context: UserContext = EMPTY_CONTEXT, note = ''): DayPlan {
  const allergens = userAllergens(context);
  const usedCountries = new Set<string>();
  const pantryUsed = new Set<string>();
  const shopping = new Set<string>();
  const chosen: { slot: MealSlot; recommendation?: Recommendation }[] = [];
  const takenMeals = new Set<number>();

  for (const slot of MEAL_SLOTS) {
    const intent = parseIntent(`${slot} ${note}`.trim());
    const pool = recipeRecords
      .filter((record) => record.slots.includes(slot))
      .filter((record) => passesAllergyFilter(record, allergens))
      .filter((record) => !excluded(record, intent) && meetsRequirements(record, intent))
      .map((record) => buildRecommendation(record, intent, context, allergens))
      .filter((r) => r.record.mealIndex === undefined || !takenMeals.has(r.record.mealIndex))
      .sort((a, b) => {
        const varietyA = usedCountries.has(a.record.country) ? -18 : 0;
        const varietyB = usedCountries.has(b.record.country) ? -18 : 0;
        return b.score + varietyB - (a.score + varietyA);
      });

    const pick = pool[0];
    if (pick) {
      usedCountries.add(pick.record.country);
      if (pick.record.mealIndex !== undefined) takenMeals.add(pick.record.mealIndex);
      pick.have.forEach((item) => pantryUsed.add(ingredientKey(item)));
      pick.need.forEach((item) => shopping.add(item));
      if (!pick.reasons.some((r) => r.kind === 'variety')) {
        pick.reasons.push({
          kind: 'variety',
          label: 'Variety',
          detail: `Keeps the day varied — ${pick.record.country}.`,
        });
      }
    }
    chosen.push({ slot, recommendation: pick });
  }

  return {
    slots: chosen,
    pantryUsed: [...pantryUsed],
    shoppingNeeded: [...shopping],
    countries: [...usedCountries],
  };
}

/** Pantry-first: what can I make with what is already here? */
export function pantryMatches(context: UserContext, limit = 5): Recommendation[] {
  const allergens = userAllergens(context);
  const intent = parseIntent('use what I have');
  return recipeRecords
    .filter((record) => passesAllergyFilter(record, allergens))
    .map((record) => buildRecommendation(record, intent, context, allergens))
    .sort((a, b) => {
      const coverageA = a.record.ingredients.length ? a.have.length / a.record.ingredients.length : 0;
      const coverageB = b.record.ingredients.length ? b.have.length / b.record.ingredients.length : 0;
      if (coverageA !== coverageB) return coverageB - coverageA;
      return a.need.length - b.need.length;
    })
    .slice(0, limit);
}

/** Shopping view for one recommendation: what you have, what you need. */
export function shoppingSplit(recommendation: Recommendation): { have: string[]; need: string[] } {
  return { have: recommendation.have, need: recommendation.need };
}

/** Allergens a free-text ingredient list would introduce. */
export function allergensFor(ingredients: string[]): Allergen[] {
  return allergensFromIngredients(ingredients);
}

export { continentFor };
export type { Difficulty };
