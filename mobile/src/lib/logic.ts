import { Meal, MealRef, mealRefs, meals } from './data';

/**
 * The prototype's rules, ported from its JavaScript so that iOS, iPadOS and
 * Android behave identically — and so there is only ever one definition of
 * "three free planning days".
 */

/** `ingredientBase(x)` */
export function ingredientBase(value: string): string {
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

/** `pantryHas(ingredient)` */
export function pantryHas(pantry: string[], ingredient: string): boolean {
  const base = ingredientBase(ingredient);
  return pantry.some((item) => {
    const q = ingredientBase(item);
    return Boolean(q) && (base.includes(q) || q.includes(base)) && base.length > 2 && q.length > 2;
  });
}

export type SmartMatch = {
  index: number;
  meal: Meal;
  have: number;
  missing: string[];
  score: number;
};

/** `smartMatches()` */
export function smartMatches(pantry: string[]): SmartMatch[] {
  return mealRefs
    .map(({ index, meal }) => {
      const have = meal.ingredients.filter((x) => pantryHas(pantry, x)).length;
      const missing = meal.ingredients.filter((x) => !pantryHas(pantry, x));
      const score = meal.ingredients.length ? have / meal.ingredients.length : 0;
      return { index, meal, have, missing, score };
    })
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length)
    .slice(0, 5);
}

/** `missing ingredients` for `addShopping(i)` */
export function missingIngredients(pantry: string[], meal: Meal): string[] {
  return meal.ingredients.filter((x) => !pantryHas(pantry, x));
}

/** `filterFood(term)` */
export function filterMeals(term: string): MealRef[] {
  const q = String(term).toLowerCase();
  return mealRefs.filter(({ meal }) => {
    const text = `${meal.name} ${meal.meta} ${meal.fit || ''} ${meal.ingredients.join(' ')} ${(
      meal.fits || []
    ).join(' ')}`.toLowerCase();
    return (
      text.includes(q) ||
      (q === 'under 30 minutes' && meal.duration <= 30) ||
      (q === 'high fibre' && text.includes('fibre'))
    );
  });
}

/**
 * Today rotates its ideas once a day: the offset comes from a seed stored
 * against the current date.
 */
export function todaysMeals(slot: string, offset: number, plus: boolean): MealRef[] {
  const count = meals.length;
  if (!count) return [];
  return mealRefs
    .filter(({ meal }) => meal.slot === slot)
    .sort((a, b) => ((a.index + offset) % count) - ((b.index + offset) % count))
    .slice(0, plus ? 8 : 4);
}

/** `validateOb()` — the onboarding gate messages, word for word. */
export function onboardingError(
  step: number,
  profile: {
    dob?: string;
    age?: string | null;
    gender?: string;
    priorities?: string[];
    diet?: string;
  },
  allergiesTouched: boolean
): string {
  if (step === 2 && !profile.dob) return 'Add your date of birth to continue.';
  if (step === 2 && profile.dob && !profile.age)
    return 'Please enter a valid date. You need to be 18 or over to use Girki.';
  if (step === 3 && !profile.gender) return 'Choose an option to continue.';
  if (step === 4 && !(profile.priorities || []).length) return 'Choose at least one priority.';
  if (step === 5 && !profile.diet) return 'Choose how you like to eat.';
  if (step === 6 && !allergiesTouched) return 'Choose None if you have no allergies.';
  return '';
}

/** `setDob(v)` — date of birth to life stage band. */
export function ageBand(dob: string): string | null {
  const date = new Date(`${dob}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const before =
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (before) age -= 1;
  if (age >= 65) return '65+';
  if (age >= 55) return '55–64';
  if (age >= 45) return '45–54';
  if (age >= 35) return '35–44';
  if (age >= 25) return '25–34';
  if (age >= 18) return '18–24';
  return null;
}

/** `submitEmailAuth()` */
export function isValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
