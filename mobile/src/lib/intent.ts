import { Difficulty } from './foodGraph';
import { continents, countries } from './data';
import { FoodTag, INGREDIENT_VOCABULARY, MealSlot, NEGATION_PATTERNS } from './taxonomy';

/**
 * Reading what a person actually asked for.
 *
 * "I want a fish lunch under 20 minutes, nothing spicy" becomes a structure the
 * engine can retrieve and rank against — and, just as importantly, a structure
 * a follow-up can refine without the user repeating themselves.
 */
export type IntentKind = 'find' | 'plan' | 'culture' | 'nutrition' | 'pantry';

export type Intent = {
  raw: string;
  kind: IntentKind;
  slots: MealSlot[];
  tags: FoodTag[];
  ingredients: string[];
  countries: string[];
  /** Continents and atlas regions named in the query, e.g. "Africa". */
  places: string[];
  maxMinutes?: number;
  difficulty?: Difficulty;
  wantsNovelty: boolean;
  wantsPantry: boolean;
  excludeTags: FoodTag[];
  excludeIngredients: string[];
  count?: number;
};

/**
 * A subject is what the food *is*; a modifier is how you want it. A follow-up
 * naming a new subject replaces the old one ("actually, chicken"), while one
 * naming only modifiers narrows what is already on screen ("make it quick").
 */
export const SUBJECT_TAGS: FoodTag[] = [
  'fish', 'shellfish', 'chicken', 'meat', 'plant based', 'vegetarian', 'salad',
  'soup', 'stew', 'grain bowl', 'noodles', 'rice', 'bread', 'street food',
];

export const EMPTY_INTENT: Intent = {
  raw: '',
  kind: 'find',
  slots: [],
  tags: [],
  ingredients: [],
  countries: [],
  places: [],
  wantsNovelty: false,
  wantsPantry: false,
  excludeTags: [],
  excludeIngredients: [],
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const REGION_NAMES = [...new Set(countries.map((c) => c.region))];

/** Words that carry no meaning for exclusion matching. */
const STOP_WORDS = new Set(['the', 'a', 'an', 'any', 'some', 'much', 'many', 'that', 'this', 'it', 'them', 'too']);

function detectCount(q: string): number | undefined {
  const digits = q.match(/\b(\d{1,2})\b(?!\s*(?:minute|min|hour))/);
  if (digits) {
    const value = Number(digits[1]);
    if (value >= 1 && value <= 20) return value;
  }
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(q)) return value;
  }
  return undefined;
}

function detectMinutes(q: string): number | undefined {
  const explicit = q.match(/\b(?:under|below|less than|within|max|maximum|in)\s*(\d{1,3})\s*(?:minute|minutes|min|mins)\b/);
  if (explicit) return Number(explicit[1]);
  const suffix = q.match(/\b(\d{1,3})\s*(?:minute|minutes|min|mins)\b/);
  if (suffix) return Number(suffix[1]);
  if (/\b(quick|quickly|fast|in a hurry|no time|easy tonight|weeknight)\b/.test(q)) return 30;
  return undefined;
}

function detectSlots(q: string): MealSlot[] {
  const slots: MealSlot[] = [];
  if (/\b(breakfast|morning|brunch)\b/.test(q)) slots.push('Breakfast');
  if (/\b(lunch|midday|lunches)\b/.test(q)) slots.push('Lunch');
  if (/\b(dinner|supper|evening|tonight|dinners)\b/.test(q)) slots.push('Dinner');
  return slots;
}

/** Everything after a negation word is what the person does *not* want. */
function detectExclusions(q: string): { tags: FoodTag[]; ingredients: string[] } {
  const phrases: string[] = [];
  for (const pattern of NEGATION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match = regex.exec(q);
    while (match) {
      phrases.push(match[1].trim());
      match = regex.exec(q);
    }
  }

  const tags = new Set<FoodTag>();
  const ingredients = new Set<string>();

  for (const phrase of phrases) {
    for (const word of phrase.split(/\s+/)) {
      const clean = word.replace(/[^a-zà-ÿ]/gi, '');
      if (!clean || STOP_WORDS.has(clean)) continue;
      for (const [tag, pattern] of QUERY_TAG_PATTERNS) {
        if (pattern.test(clean) || tag === clean) tags.add(tag);
      }
      for (const ingredient of INGREDIENT_VOCABULARY) {
        if (ingredient === clean || `${ingredient}s` === clean || ingredient === `${clean}s`) {
          ingredients.add(ingredient);
        }
      }
    }
  }

  return { tags: [...tags], ingredients: [...ingredients] };
}

/**
 * What a *query* asks for, which is not the same as how a *dish* is described.
 *
 * The graph tags a salmon dish as "high protein" because it is; a person typing
 * "fish" is not asking for high protein food. Query reading therefore has its
 * own, narrower vocabulary: only what was actually requested.
 */
const QUERY_TAG_PATTERNS: [FoodTag, RegExp][] = [
  ['fish', /\b(fish|seafood|salmon|cod|tuna|tilapia|sardines?|mackerel|trout|anchov\w*)\b/],
  ['shellfish', /\b(shellfish|prawns?|shrimps?|crab|lobster|mussels?|squid|octopus)\b/],
  ['chicken', /\b(chicken|poultry)\b/],
  ['meat', /\b(meat|beef|lamb|mutton|pork|steak|mince|sausage|goat)\b/],
  ['plant based', /\b(plant based|plant-based|vegan|vegetarian|meat ?free|meatless|more plants|plants)\b/],
  ['vegetarian', /\b(vegetarian|veggie)\b/],
  ['salad', /\b(salads?)\b/],
  ['soup', /\b(soups?|broth)\b/],
  ['stew', /\b(stews?|curry|curries|tagine)\b/],
  ['grain bowl', /\b(bowls?|grain bowl)\b/],
  ['noodles', /\b(noodles?|pasta|ramen|pho|phở)\b/],
  ['rice', /\b(rice|risotto|biryani|paella)\b/],
  ['bread', /\b(bread|sandwich|toast|wrap|flatbread)\b/],
  ['comforting', /\b(comfort\w*|hearty|cosy|cozy|warming)\b/],
  ['light', /\b(light|lighter|fresh)\b/],
  ['spicy', /\b(spicy|spiced|chilli|chili)\b/],
  ['high protein', /\b(high protein|more protein|protein)\b/],
  ['high fibre', /\b(high fibre|high fiber|more fibre|more fiber|fibre|fiber)\b/],
  ['quick', /\b(quick|quickly|fast|easy|simple|weeknight|no time|in a hurry)\b/],
  ['street food', /\b(street food)\b/],
  ['grilled', /\b(grilled|grill|barbecue|bbq)\b/],
  ['baked', /\b(baked|bake|roast|roasted)\b/],
  ['raw', /\b(raw|ceviche|sashimi|poke)\b/],
];

function detectTags(q: string, excluded: Set<FoodTag>): FoodTag[] {
  const tags = new Set<FoodTag>();
  for (const [tag, pattern] of QUERY_TAG_PATTERNS) {
    if (excluded.has(tag)) continue;
    if (pattern.test(q)) tags.add(tag);
  }
  // "Vegetarian" covers both readings in the graph's vocabulary.
  if (tags.has('vegetarian') && !excluded.has('plant based')) tags.add('plant based');
  for (const tag of excluded) tags.delete(tag);
  return [...tags];
}

function detectPlaces(q: string): { countries: string[]; places: string[] } {
  const named: string[] = [];
  for (const country of countries) {
    const name = country.name.toLowerCase();
    if (name.length < 4) continue;
    if (q.includes(name)) named.push(country.name);
  }
  // Longer names win: "New Zealand" should not also match nothing else.
  named.sort((a, b) => b.length - a.length);

  const places: string[] = [];
  for (const continent of continents) {
    if (continent === 'All') continue;
    if (q.includes(continent.toLowerCase())) places.push(continent);
  }
  for (const region of REGION_NAMES) {
    if (region.length < 5) continue;
    if (q.includes(region.toLowerCase())) places.push(region);
  }
  if (/\bafrican\b/.test(q) && !places.includes('Africa')) places.push('Africa');
  if (/\basian\b/.test(q) && !places.includes('Asia')) places.push('Asia');
  if (/\beuropean\b/.test(q) && !places.includes('Europe')) places.push('Europe');

  return { countries: named, places };
}

function detectIngredients(q: string, excluded: Set<string>): string[] {
  const found = INGREDIENT_VOCABULARY.filter(
    (word) => new RegExp(`\\b${word}\\b`).test(q) && !excluded.has(word)
  );
  // "chickpeas" and "chickpea" are the same request.
  return [...new Set(found.map((w) => w.replace(/s$/, '')))];
}

function detectKind(q: string): IntentKind {
  if (/\bplan\b|\bplan my\b|tomorrow|for the day|whole day|breakfast.*lunch|lunch.*dinner/.test(q)) return 'plan';
  if (/\bhistory|story behind|traditional|authentic|where.*from|culture|origin\b/.test(q)) return 'culture';
  if (/\bnutrition|nutrients?|protein|fibre|fiber|calories|healthy|benefit/.test(q)) return 'nutrition';
  if (/\bpantry|what i have|use what|at home|in my kitchen|i have\b/.test(q)) return 'pantry';
  return 'find';
}

/** Parse a natural request into a structured intent. */
export function parseIntent(query: string): Intent {
  const q = String(query || '').toLowerCase().trim();
  const exclusions = detectExclusions(q);
  const excludedTags = new Set(exclusions.tags);
  const excludedIngredients = new Set(exclusions.ingredients);

  const { countries: namedCountries, places } = detectPlaces(q);
  const kind = detectKind(q);

  return {
    raw: query,
    kind,
    slots: detectSlots(q),
    tags: detectTags(q, excludedTags),
    ingredients: detectIngredients(q, excludedIngredients),
    countries: namedCountries,
    places,
    maxMinutes: detectMinutes(q),
    difficulty: /\beasiest|simplest|least effort|no fuss\b/.test(q) ? 'easy' : undefined,
    wantsNovelty: /\bnew|different|surprise|somewhere new|never tried|adventurous|discover\b/.test(q),
    wantsPantry: kind === 'pantry' || /\bpantry|what i have|use what|at home|already have\b/.test(q),
    excludeTags: exclusions.tags,
    excludeIngredients: exclusions.ingredients,
    count: detectCount(q),
  };
}

/**
 * Merge a follow-up into the intent it refines, so "which of those use what I
 * have?" keeps the fish, and "make them lunches" keeps both.
 */
export function refineIntent(previous: Intent, followUp: string): Intent {
  const next = parseIntent(followUp);
  const referencesPrevious = /\b(those|them|these|that|it|ones|instead|as well|also|and)\b/.test(
    followUp.toLowerCase()
  );

  // A follow-up that names nothing new but references the last answer is a
  // pure refinement; otherwise merge, letting the new request lead.
  const nextSubjects = next.tags.filter((tag) => SUBJECT_TAGS.includes(tag));
  const previousSubjects = previous.tags.filter((tag) => SUBJECT_TAGS.includes(tag));
  const nextModifiers = next.tags.filter((tag) => !SUBJECT_TAGS.includes(tag));
  const previousModifiers = previous.tags.filter((tag) => !SUBJECT_TAGS.includes(tag));

  // A new subject replaces the old one; modifiers accumulate.
  const subjects = nextSubjects.length ? nextSubjects : previousSubjects;
  const modifiers = [...new Set([...previousModifiers, ...nextModifiers])];

  const merged: Intent = {
    raw: followUp,
    kind: next.kind === 'find' && referencesPrevious ? previous.kind : next.kind,
    slots: next.slots.length ? next.slots : previous.slots,
    tags: [...new Set([...subjects, ...modifiers])],
    ingredients: next.ingredients.length ? next.ingredients : previous.ingredients,
    countries: next.countries.length ? next.countries : previous.countries,
    places: next.places.length ? next.places : previous.places,
    maxMinutes: next.maxMinutes ?? previous.maxMinutes,
    difficulty: next.difficulty ?? previous.difficulty,
    wantsNovelty: next.wantsNovelty || (referencesPrevious && previous.wantsNovelty),
    wantsPantry: next.wantsPantry || (referencesPrevious && previous.wantsPantry),
    excludeTags: [...new Set([...previous.excludeTags, ...next.excludeTags])],
    excludeIngredients: [...new Set([...previous.excludeIngredients, ...next.excludeIngredients])],
    count: next.count ?? undefined,
  };

  // An exclusion added later must win over an earlier inclusion.
  merged.tags = merged.tags.filter((tag) => !merged.excludeTags.includes(tag));
  merged.ingredients = merged.ingredients.filter((i) => !merged.excludeIngredients.includes(i));
  return merged;
}

/** A short, human description of what Nourish understood. */
export function describeIntent(intent: Intent): string {
  const parts: string[] = [];
  if (intent.tags.length) parts.push(intent.tags.slice(0, 3).join(', '));
  if (intent.ingredients.length) parts.push(intent.ingredients.slice(0, 3).join(', '));
  if (intent.slots.length) parts.push(intent.slots.join(' and ').toLowerCase());
  if (intent.countries.length) parts.push(intent.countries.slice(0, 2).join(', '));
  if (intent.places.length) parts.push(intent.places.slice(0, 2).join(', '));
  if (intent.maxMinutes) parts.push(`under ${intent.maxMinutes} minutes`);
  if (intent.difficulty === 'easy') parts.push('easy to make');
  if (intent.wantsPantry) parts.push('using your pantry');
  if (intent.wantsNovelty) parts.push('somewhere new');
  if (intent.excludeTags.length || intent.excludeIngredients.length) {
    parts.push(`without ${[...intent.excludeTags, ...intent.excludeIngredients].slice(0, 3).join(', ')}`);
  }
  return parts.join(' · ');
}
