/**
 * The Girki food graph.
 *
 * Two kinds of record, and the difference matters everywhere in the product:
 *
 *   'recipe'    — a curated Girki record with verified ingredients, method,
 *                 nutrition and an image. It can be cooked.
 *   'discovery' — a dish from the 195-country atlas. Girki knows the dish,
 *                 its country and its region, and nothing else it can stand
 *                 behind. It can be explored, never presented as a recipe.
 *
 * Characteristics read from a dish *name* (meal slot, tags, likely allergens)
 * are hints. Every record carries `inference` so the UI and the engine can tell
 * the difference between "Girki knows" and "Girki suspects".
 */
import {
  ALLERGENS, ALLERGEN_KEYWORDS, Allergen, BREAKFAST_KEYWORDS, FoodTag, INGREDIENT_VOCABULARY,
  LUNCH_KEYWORDS, MealSlot, TAG_KEYWORDS,
} from './taxonomy';
import { Meal, continentFor, countries, meals } from './data';
import { lexiconTags } from './dishLexicon';

export type RecordKind = 'recipe' | 'discovery';

/**
 * How a record relates to the food culture it comes from. Nothing is called
 * traditional without evidence.
 */
export type CulturalStatus =
  | 'traditional-dish'        // named by the country atlas as part of that food culture
  | 'traditional-recipe'      // a traditional dish with a verified recipe
  | 'girki-adaptation'      // a practical home version of a traditional dish
  | 'girki-original'        // a Girki recipe, not claiming a tradition
  | 'unclassified';

export type Difficulty = 'easy' | 'moderate' | 'involved';

export type ImageProvenance = {
  url: string;
  source: string;
  licence: string;
  attribution: string;
  /** False until an editor has signed the asset off for production. */
  editorialApproved: boolean;
};

export type FoodRecord = {
  id: string;
  kind: RecordKind;
  title: string;

  // Place
  country: string;
  region: string;
  continent: string;

  // Classification
  slots: MealSlot[];
  tags: FoodTag[];

  // Composition
  ingredients: string[];
  /** Ingredient names with quantities and units stripped, for matching. */
  ingredientKeys: string[];
  allergens: Allergen[];

  // Practicalities
  minutes?: number;
  difficulty?: Difficulty;
  calories?: number;
  steps?: string[];

  // Trust
  culturalStatus: CulturalStatus;
  provenance: string;
  image?: ImageProvenance;

  /** Which fields are inferred from a dish name rather than known. */
  inference: {
    slots: boolean;
    tags: boolean;
    ingredients: boolean;
    allergens: boolean;
  };

  /** Index into the curated `meals` array, for recipe records. */
  mealIndex?: number;
};

/** `ingredientBase()` — quantities and units removed, for matching. */
export function ingredientKey(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(
      /\b\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|tbsp|tsp|handful|small|large|slice|slices|clove|cloves)\b/g,
      ''
    )
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Allergens present in a structured ingredient list. */
export function allergensFromIngredients(ingredients: string[]): Allergen[] {
  const text = ingredients.join(' ').toLowerCase();
  return ALLERGENS.filter((allergen) =>
    ALLERGEN_KEYWORDS[allergen].some((keyword) => text.includes(keyword))
  );
}

/** Allergens a dish *name* hints at. Suspicion only — never a clearance. */
export function allergenHintsFromName(name: string): Allergen[] {
  const text = name.toLowerCase();
  return ALLERGENS.filter((allergen) =>
    ALLERGEN_KEYWORDS[allergen].some((keyword) => text.includes(keyword))
  );
}

function tagsFor(text: string): FoodTag[] {
  const found = (Object.keys(TAG_KEYWORDS) as FoodTag[]).filter((tag) =>
    TAG_KEYWORDS[tag].test(text)
  );
  // Fish and meat are not "plant based", whatever the vegetables alongside.
  if (found.includes('fish') || found.includes('meat') || found.includes('chicken') || found.includes('shellfish')) {
    return found.filter((t) => t !== 'plant based');
  }
  return found;
}

/** Ingredient words a dish name implies. Used for retrieval, not for a recipe. */
function impliedIngredients(name: string): string[] {
  const text = name.toLowerCase();
  return INGREDIENT_VOCABULARY.filter((word) => text.includes(word));
}

function slotsForDish(name: string, tags: FoodTag[]): MealSlot[] {
  if (BREAKFAST_KEYWORDS.test(name)) return ['Breakfast'];
  if (LUNCH_KEYWORDS.test(name) || tags.includes('salad') || tags.includes('light')) {
    return ['Lunch', 'Dinner'];
  }
  return ['Lunch', 'Dinner'];
}

/** Curated meals carry a real duration; difficulty follows time and steps. */
function difficultyFor(minutes: number, steps: number): Difficulty {
  if (minutes <= 20 && steps <= 4) return 'easy';
  if (minutes <= 35) return 'moderate';
  return 'involved';
}

const CURATED_CULTURE_REGION: Record<string, string> = {
  Ghana: 'West Africa',
  Sweden: 'Northern Europe',
  Japan: 'East Asia',
  Vietnam: 'Southeast Asia',
  Korea: 'East Asia',
  Fiji: 'Pacific',
  India: 'South Asia',
  Türkiye: 'Anatolia',
  Amazon: 'Amazonia',
  'Hawaiʻi': 'Pacific Islands',
  Nepal: 'South Asia',
  Ethiopia: 'East Africa',
  Morocco: 'North Africa',
  Mexico: 'North America',
  Greece: 'Mediterranean',
  'Modern home kitchen': 'Modern home kitchen',
};

/**
 * A curated meal becomes a recipe record. Its cultural status depends on
 * whether it claims a tradition: a dish with a `culture` is a traditional dish
 * that Girki has adapted for a home kitchen; the rest are Girki originals.
 */
function recipeRecord(meal: Meal, index: number): FoodRecord {
  const country = meal.culture && meal.culture !== 'Modern home kitchen' ? meal.culture : 'Modern home kitchen';
  const region = CURATED_CULTURE_REGION[country] || 'Modern home kitchen';
  const text = `${meal.name} ${meal.meta} ${meal.ingredients.join(' ')} ${(meal.fits || []).join(' ')}`;
  const tags = tagsFor(text);

  if (meal.duration <= 30 && !tags.includes('quick')) tags.push('quick');
  for (const fit of meal.fits || []) {
    if (/vegan|vegetarian/i.test(fit) && !tags.includes('plant based')) tags.push('plant based');
    if (/spicy/i.test(fit) && !tags.includes('spicy')) tags.push('spicy');
    if (/comforting/i.test(fit) && !tags.includes('comforting')) tags.push('comforting');
  }

  return {
    id: `recipe:${index}`,
    kind: 'recipe',
    title: meal.name,
    country,
    region,
    continent: country === 'Modern home kitchen' ? 'Modern home kitchen' : continentFor(country),
    slots: [meal.slot as MealSlot],
    tags,
    ingredients: meal.ingredients,
    ingredientKeys: meal.ingredients.map(ingredientKey).filter(Boolean),
    allergens: allergensFromIngredients(meal.ingredients),
    minutes: meal.duration,
    difficulty: difficultyFor(meal.duration, meal.steps.length),
    calories: meal.cal,
    steps: meal.steps,
    culturalStatus: meal.culture ? 'girki-adaptation' : 'girki-original',
    provenance: 'Girki curated library',
    image: {
      url: meal.img,
      source: /commons\.wikimedia/.test(meal.img) ? 'Wikimedia Commons' : 'Unsplash',
      licence: 'Prototype asset — licence to be recorded before production',
      attribution: '',
      editorialApproved: false,
    },
    inference: { slots: false, tags: true, ingredients: false, allergens: false },
    mealIndex: index,
  };
}

/**
 * A dish from the country atlas becomes a discovery record: the dish, where it
 * is from, and hints. No recipe, no nutrition, no claim of authenticity beyond
 * "the atlas lists this dish for this country".
 */
function discoveryRecord(dish: string, country: string, region: string, index: number): FoodRecord {
  const lexicon = lexiconTags(dish);
  const tags = [...new Set([...tagsFor(dish), ...lexicon.tags])];
  // Fish, meat and poultry override a plant-based reading of the same name.
  const cleaned = tags.includes('fish') || tags.includes('meat') || tags.includes('chicken') || tags.includes('shellfish')
    ? tags.filter((t) => t !== 'plant based')
    : tags;
  return {
    id: `discovery:${country}:${index}`,
    kind: 'discovery',
    title: dish,
    country,
    region,
    continent: continentFor(country),
    slots: lexicon.slots.length ? lexicon.slots : slotsForDish(dish, cleaned),
    tags: cleaned,
    ingredients: [],
    ingredientKeys: impliedIngredients(dish),
    allergens: allergenHintsFromName(dish),
    // A dish name is not an ingredient list: hints only, never a clearance.
    culturalStatus: 'traditional-dish',
    provenance: 'Girki country atlas',
    inference: { slots: true, tags: true, ingredients: true, allergens: true },
  };
}

/** Every curated recipe Girki can actually cook. */
export const recipeRecords: FoodRecord[] = meals.map(recipeRecord);

/** Every dish the 195-country atlas knows about. */
export const discoveryRecords: FoodRecord[] = countries.flatMap((country) =>
  country.foods.map((dish, index) => discoveryRecord(dish, country.name, country.region, index))
);

/** The whole food universe: what can be cooked, plus what can be discovered. */
export const foodGraph: FoodRecord[] = [...recipeRecords, ...discoveryRecords];

export const recordsById = new Map(foodGraph.map((record) => [record.id, record]));

/**
 * An ingredient index across the graph: "which records use salmon?" — the
 * question the flat meal list could never answer.
 */
export const ingredientIndex: Map<string, FoodRecord[]> = (() => {
  const index = new Map<string, FoodRecord[]>();
  for (const record of foodGraph) {
    const words = new Set<string>();
    for (const key of record.ingredientKeys) {
      for (const word of key.split(' ')) if (word.length > 2) words.add(word);
    }
    for (const word of words) {
      const list = index.get(word);
      if (list) list.push(record);
      else index.set(word, [record]);
    }
  }
  return index;
})();

export function recordsWithIngredient(word: string): FoodRecord[] {
  return ingredientIndex.get(word.toLowerCase()) || [];
}

/** Country → its records, for country-led discovery. */
export const recordsByCountry: Map<string, FoodRecord[]> = (() => {
  const index = new Map<string, FoodRecord[]>();
  for (const record of foodGraph) {
    const list = index.get(record.country);
    if (list) list.push(record);
    else index.set(record.country, [record]);
  }
  return index;
})();

/** What a record offers the user: a recipe to cook, or a dish to explore. */
export function recordAction(record: FoodRecord): 'Cook recipe' | 'Explore dish' {
  return record.kind === 'recipe' ? 'Cook recipe' : 'Explore dish';
}

export const graphStats = {
  recipes: recipeRecords.length,
  discoveries: discoveryRecords.length,
  /** Places, not countries: curated recipes add food cultures such as Amazon. */
  places: new Set(foodGraph.map((r) => r.country)).size,
  atlasCountries: countries.length,
  ingredients: ingredientIndex.size,
  tagged: foodGraph.filter((r) => r.tags.length > 0).length,
};
