import { canonicalCountry, countries, countryRegion, dishes, freeCountries } from './content';

/**
 * The passport.
 *
 * A cook log entry is keyed by dish **name and country**, never by an array
 * index — the prototype's original index keying scrambled its own history, and
 * the brief calls this out specifically.
 */

export type CookLogEntry = {
  dish: string;
  country: string;
  /** ISO timestamp. */
  at: string;
  kcal: number;
  minutes: number;
};

export type Passport = {
  log: CookLogEntry[];
  countries: string[];
  regions: string[];
  dishes: string[];
  last: CookLogEntry | null;
  cooks: number;
  totalCountries: number;
};

/** `girkiPassport` */
export function passportFrom(log: CookLogEntry[]): Passport {
  const normalised = (log || []).map((entry) => ({
    ...entry,
    country: canonicalCountry(entry.country),
  }));
  const visited = [...new Set(normalised.map((x) => x.country).filter(Boolean))];
  return {
    log: normalised,
    countries: visited,
    regions: [...new Set(visited.map(countryRegion).filter(Boolean))],
    dishes: [...new Set(normalised.map((x) => x.dish))],
    last: normalised.length ? normalised[normalised.length - 1] : null,
    cooks: normalised.length,
    totalCountries: countries.length,
  };
}

/** `girkiWhen` — how long ago, in words. */
export function whenText(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const days = Math.floor((now.getTime() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** `girkiSuggestNext` — where to go next, phrased as an invitation. */
export function suggestNext(passport: Passport): string {
  if (!passport.countries.length) {
    return 'Twelve countries are open without Girki+. Start anywhere — the ones you have never heard of are usually the good ones.';
  }
  const done = new Set(passport.regions);
  const unvisited = [...new Set(countries.map((c) => c.region))].find((r) => r && !done.has(r));
  if (unvisited) {
    return `You have not cooked anything from ${unvisited} yet. That is a whole region of food waiting.`;
  }
  return 'You have reached every region. Now it is worth going deeper — most countries have far more than the three dishes shown.';
}

/** A dish worth suggesting next: an unvisited region first, then a new country. */
export function nextDishSuggestion(passport: Passport, plus: boolean) {
  const cooked = new Set(passport.countries);
  const regionsDone = new Set(passport.regions);
  const pool = dishes.filter((d) => (plus ? true : freeCountries.includes(d.country)));

  const newRegion = pool.find((d) => !regionsDone.has(d.region) && !cooked.has(d.country));
  if (newRegion) return newRegion;
  const newCountry = pool.find((d) => !cooked.has(d.country));
  return newCountry || pool[0] || null;
}

/** Stamps, grouped by region, for the passport screen. */
export function stampsByRegion(passport: Passport) {
  const byRegion = new Map<string, { country: string; cooks: number }[]>();
  for (const country of passport.countries) {
    const region = countryRegion(country) || 'Elsewhere';
    const cooks = passport.log.filter((x) => x.country === country).length;
    const list = byRegion.get(region);
    if (list) list.push({ country, cooks });
    else byRegion.set(region, [{ country, cooks }]);
  }
  return [...byRegion.entries()]
    .map(([region, stamps]) => ({ region, stamps }))
    .sort((a, b) => b.stamps.length - a.stamps.length);
}

/** A country is open to free members only if it is one of the twelve. */
export function countryIsOpen(country: string, plus: boolean): boolean {
  return plus || freeCountries.includes(canonicalCountry(country));
}
