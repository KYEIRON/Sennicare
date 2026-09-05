import clipsJson from '../../data/girki/clips.json';
import countriesJson from '../../data/girki/countries.json';
import dishesJson from '../../data/girki/dishes.json';
import familiesJson from '../../data/girki/families.json';
import freeCountriesJson from '../../data/girki/freeCountries.json';
import mealsJson from '../../data/girki/meals.json';
import mediaJson from '../../data/girki/media.json';
import occasionsJson from '../../data/girki/occasions.json';
import preferencesJson from '../../data/girki/preferences.json';
import recipesJson from '../../data/girki/recipes.json';
import substitutionsJson from '../../data/girki/substitutions.json';

/**
 * The Girki content bundle.
 *
 * Built from the V54 prototype by `npm run content:build` and proved by
 * `npm run verify:content`. Nothing in the app reads the prototype directly.
 */

export type Country = {
  id: string; name: string; region: string; areas: string[]; foods: string[];
};

export type Dish = {
  id: string; country: string; countryId: string; region: string;
  name: string; slot: string; source: string; curated: boolean;
};

export type Nutrient = { name: string; percentage: number };

export type Recipe = {
  id: string; key: string; country: string; countryId: string; name: string;
  slot: string; minutes: number; kcal: number;
  ingredients: string[]; steps: string[]; nutrients: Nutrient[];
  culturalNote: string; isAuthored: boolean; editorialStatus: 'authored';
  atlasDishId: string | null;
  /** The prototype reaches a recipe by `country::dish`; some names are absent. */
  reachableFromAtlas: boolean;
};

export type Meal = {
  id: string; legacyIndex: number; name: string; slot: string;
  minutes: number; kcal: number; meta: string; image: string;
  ingredients: string[]; steps: string[];
  nutrients: string[] | null; fit: string | null;
  culture: string | null; fits: string[] | null;
};

export type Family = {
  id: string; name: string; match: string; matchFlags: string;
  ingredients: string[]; steps: string[]; nutrients: Nutrient[];
  minutes: number; kcal: number; editorialStatus: 'generated';
};

export type Clip = {
  id: string; file: string; alt: string;
  match: string; matchFlags: string; and: string | null; not: string | null;
};

export type Occasion = {
  id: string; icon: string; name: string; blurb: string;
  want: { maxMin?: number; minMin?: number };
  prefer: string | null; tip: string;
  /** "I don't know what I want" goes to the atlas rather than the meal list. */
  surprise?: boolean;
};

export type Media = {
  id: string; url: string; file: string; source: string; licence: string;
  author: string; attributionRequired: boolean;
  depictsActualDish: boolean | null; dish: string | null;
  localTarget: string | null; shotNote: string | null; status: string;
};

export const countries = countriesJson as Country[];
export const dishes = dishesJson as Dish[];
export const recipes = recipesJson as Recipe[];
export const meals = mealsJson as Meal[];
export const families = familiesJson as Family[];
export const clips = clipsJson as Clip[];
export const occasions = occasionsJson as Occasion[];
export const media = mediaJson as Media[];
export const substitutions = substitutionsJson as { term: string; substitution: string }[];
export const preferences = preferencesJson as {
  regions: string[];
  confidence: { id: string; label: string; detail: string }[];
  weeknight: { id: string; label: string }[];
  foodInterests: string[];
  discoveryLevels: { id: string; label: string; detail: string }[];
};

/** Free membership opens twelve countries. Girki+ opens all 195. */
export const freeCountries = freeCountriesJson as string[];

export const dishesById = new Map(dishes.map((d) => [d.id, d]));
export const countriesByName = new Map(countries.map((c) => [c.name, c]));
export const mediaByUrl = new Map(media.map((m) => [m.url, m]));

export const dishesByCountry: Map<string, Dish[]> = (() => {
  const index = new Map<string, Dish[]>();
  for (const dish of dishes) {
    const list = index.get(dish.country);
    if (list) list.push(dish);
    else index.set(dish.country, [dish]);
  }
  return index;
})();

/** Compile a stored pattern. Patterns are content, and they are verified. */
export function pattern(source: string, flags = 'i'): RegExp {
  return new RegExp(source, flags);
}

/**
 * `girkiCountry()` — people and data both say "Korea" and "Turkey".
 * Map the common short forms onto the atlas names.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  Korea: 'South Korea',
  Turkey: 'Türkiye',
  Turkiye: 'Türkiye',
  UK: 'United Kingdom',
  USA: 'United States',
  US: 'United States',
  Holland: 'Netherlands',
  Ivory: "Côte d’Ivoire",
};

export function canonicalCountry(name: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  if (countriesByName.has(trimmed)) return trimmed;
  return COUNTRY_ALIASES[trimmed] || trimmed;
}

export function countryRegion(name: string): string {
  return countriesByName.get(canonicalCountry(name))?.region || '';
}
