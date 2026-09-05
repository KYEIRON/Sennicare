import {
  Dish, Family, Nutrient, Recipe, dishes, families, meals, pattern, recipes, substitutions,
} from './content';
import { totalMinutes } from './cook';

/**
 * Turning any atlas dish into something cookable.
 *
 * Ported from `n37RecipeFor` / `n37EnsureMeal`. A dish with a hand-written
 * recipe uses it. Everything else gets an honest home version from a family
 * template — clearly labelled as an interpretation, never as the tradition.
 */

export type CookableSource = 'authored' | 'family' | 'curated';

export type Cookable = {
  id: string;
  country: string;
  dish: string;
  slot: string;
  minutes: number;
  kcal: number;
  ingredients: string[];
  steps: string[];
  nutrients: Nutrient[];
  note: string;
  /** Written by hand, or generated from a family template. */
  source: CookableSource;
  authored: boolean;
  family?: string;
  image?: string | null;
};

const familyPatterns = families.map((f) => ({ family: f, re: pattern(f.match, f.matchFlags) }));

/** `n37Family` — the closest family, falling back to the last one. */
export function familyFor(dish: string): Family {
  const found = familyPatterns.find((f) => f.re.test(String(dish || '')));
  return found ? found.family : families[families.length - 1];
}

const recipesByKey = new Map(recipes.map((r) => [`${r.country}::${r.name}`, r]));

/**
 * A normalised index, so a recipe written as "Chicken adobo" can still be found
 * for the atlas dish "Adobo". The prototype matches the raw key only, which
 * leaves 17 of its 32 recipes unreachable; that is recorded in the migration
 * notes as a decision for Ronald, and this index does not change any content.
 */
const norm = (v: string) =>
  String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const recipesByNormalisedKey = new Map(recipes.map((r) => [`${norm(r.country)}::${norm(r.name)}`, r]));

export function authoredRecipe(country: string, dish: string): Recipe | undefined {
  return recipesByKey.get(`${country}::${dish}`);
}

/** Strict first, exactly as the prototype; normalised only as a fallback. */
export function authoredRecipeLoose(country: string, dish: string): Recipe | undefined {
  return authoredRecipe(country, dish) || recipesByNormalisedKey.get(`${norm(country)}::${norm(dish)}`);
}

/** `n37RecipeFor` — a cookable record for any country and dish. */
export function cookableFor(country: string, dish: string, options: { loose?: boolean } = {}): Cookable {
  const hand = options.loose ? authoredRecipeLoose(country, dish) : authoredRecipe(country, dish);
  if (hand) {
    return {
      id: hand.id,
      country,
      dish,
      slot: hand.slot,
      minutes: hand.minutes,
      kcal: hand.kcal,
      ingredients: hand.ingredients,
      steps: hand.steps,
      nutrients: hand.nutrients,
      note: hand.culturalNote,
      source: 'authored',
      authored: true,
    };
  }

  const family = familyFor(dish);
  const slot = family.id === 'flatbread' || /breakfast|porridge/i.test(family.id) ? 'Breakfast' : 'Dinner';
  return {
    id: `family:${family.id}:${country}:${dish}`,
    country,
    dish,
    slot,
    minutes: family.minutes,
    kcal: family.kcal,
    ingredients: family.ingredients,
    steps: [...family.steps],
    nutrients: family.nutrients,
    note:
      `A Girki home version of ${dish}, built around the way a ${family.name} from ${country} is ` +
      'usually made and the ingredients an ordinary supermarket carries. It is an interpretation, ' +
      'not the traditional recipe — those vary by region, family and season.',
    source: 'family',
    authored: false,
    family: family.name,
  };
}

/**
 * `n37EnsureMeal` — the same, with the stated time corrected to match the
 * method, so a plan never promises 45 minutes for something that needs 90.
 */
export function cookableForDish(dish: Dish, options: { loose?: boolean } = {}): Cookable {
  const cookable = cookableFor(dish.country, dish.name, options);
  const implied = totalMinutes(cookable.steps);
  return {
    ...cookable,
    minutes: implied > 0 ? implied : cookable.minutes,
    slot: dish.slot && dish.slot !== 'Lunch / Dinner' ? dish.slot : cookable.slot,
  };
}

/** A curated meal, in the same shape. */
export function cookableForMeal(name: string): Cookable | null {
  const meal = meals.find((m) => m.name === name);
  if (!meal) return null;
  return {
    id: meal.id,
    country: meal.culture || 'Girki kitchen',
    dish: meal.name,
    slot: meal.slot,
    minutes: meal.minutes,
    kcal: meal.kcal,
    ingredients: meal.ingredients,
    steps: meal.steps,
    nutrients: [],
    note: meal.fit || '',
    source: 'curated',
    authored: true,
    image: meal.image,
  };
}

/* ---------- ingredient accessibility ---------- */

/** `N37_EASY` — everything an ordinary supermarket carries. */
const EASY = /water|salt|pepper|oil|onion|garlic|tomato|carrot|potato|rice|pasta|noodle|flour|sugar|egg|milk|butter|yoghurt|cheese|chicken|beef|pork|lamb|fish|salmon|cod|tuna|prawn|lentil|chickpea|bean|pea|spinach|cabbage|courgette|pepper|cucumber|lemon|lime|orange|apple|banana|coriander|parsley|mint|basil|thyme|cumin|paprika|turmeric|cinnamon|chilli|ginger|stock|bread|oats|coconut milk|soy sauce|vinegar|honey|raisin|almond|sesame|spring onion|leek|mushroom|broccoli|cauliflower|aubergine|sweet potato|corn|celery|beetroot|olive/i;

export type Accessibility = 'easy' | 'sometimes' | 'specialist';

export type IngredientAccess = {
  text: string;
  level: Accessibility;
  substitution?: string;
  term?: string;
};

/** `n37IngredientAccess` */
export function ingredientAccess(text: string): IngredientAccess {
  const t = String(text).toLowerCase();
  const found = substitutions.find((s) => t.includes(s.term));
  if (found) return { text, level: 'specialist', substitution: found.substitution, term: found.term };
  if (EASY.test(t)) return { text, level: 'easy' };
  return { text, level: 'sometimes' };
}

export type AccessibilityReport = {
  rows: IngredientAccess[];
  specialist: IngredientAccess[];
  sometimes: IngredientAccess[];
  score: string;
  /** Supermarket language is global; never a chain name. */
  where: string;
};

/** `n37Accessibility` */
export function accessibility(ingredients: string[]): AccessibilityReport {
  const rows = (ingredients || []).map(ingredientAccess);
  const specialist = rows.filter((r) => r.level === 'specialist');
  const sometimes = rows.filter((r) => r.level === 'sometimes');
  const score = specialist.length === 0
    ? (sometimes.length <= 1 ? 'Very easy' : 'Easy')
    : (specialist.length <= 2 ? 'Mostly easy' : 'Some specialist items');
  const where = specialist.length
    ? 'Speciality or world food shop for a few items'
    : sometimes.length
    ? 'Larger supermarkets'
    : 'Most supermarkets';
  return { rows, specialist, sometimes, score, where };
}

/** Every dish, with the recipe that would be used to cook it. */
export function authoredCount(): { authored: number; generated: number } {
  let authored = 0;
  for (const dish of dishes) if (authoredRecipeLoose(dish.country, dish.name)) authored += 1;
  return { authored, generated: dishes.length - authored };
}
