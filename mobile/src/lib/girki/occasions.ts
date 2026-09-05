import { Dish, Occasion, dishes, freeCountries, meals, occasions, pattern } from './content';
import { Cookable, cookableForDish, cookableForMeal } from './recipes';

/**
 * Occasions.
 *
 * Ported from `n39Pick`. The rule that matters: only narrow to the preferred
 * set when it is big enough to be a real choice, otherwise a good occasion
 * returns two options.
 */

export type OccasionPick = {
  cookable: Cookable;
  dish?: Dish;
  mealName?: string;
};

export function occasionById(id: string): Occasion | undefined {
  return occasions.find((o) => o.id === id);
}

/**
 * `n39Pick`'s surprise branch: four dishes from the whole atlas, chosen by a
 * stride seeded on the date, so "I don't know what I want" answers differently
 * each day rather than randomly on every tap.
 */
export function surpriseDishes(seedDate: Date = new Date(), count = 4): Dish[] {
  const seed = seedDate.getDate();
  const picked: Dish[] = [];
  for (let k = 0; k < count; k += 1) {
    const dish = dishes[(seed * 37 + k * 991) % dishes.length];
    if (dish && !picked.includes(dish)) picked.push(dish);
  }
  return picked;
}

export function pickForOccasion(
  occasion: Occasion,
  count = 4,
  options: { plus?: boolean; exploredCountries?: string[]; today?: Date } = {}
): OccasionPick[] {
  const plus = options.plus ?? false;
  const explored = new Set(options.exploredCountries || []);

  // A surprise occasion goes straight to the atlas, as the prototype does,
  // preferring somewhere the person has not cooked from yet.
  if (occasion.surprise) {
    const seeded = surpriseDishes(options.today || new Date(), count * 3);
    const fresh = seeded.filter((d) => !explored.has(d.country));
    const chosen = (fresh.length >= count ? fresh : seeded).slice(0, count);
    return chosen.map((dish) => ({ cookable: cookableForDish(dish, { loose: true }), dish }));
  }

  let pool = meals
    .map((m) => ({ meal: m, cookable: cookableForMeal(m.name) }))
    .filter((x): x is { meal: typeof meals[number]; cookable: Cookable } => Boolean(x.cookable));

  if (occasion.want.maxMin) pool = pool.filter((x) => x.meal.minutes <= (occasion.want.maxMin as number));
  if (occasion.want.minMin) pool = pool.filter((x) => x.meal.minutes >= (occasion.want.minMin as number));

  if (occasion.prefer) {
    const prefer = pattern(occasion.prefer, 'i');
    const hit = pool.filter((x) => prefer.test(x.meal.name));
    pool = hit.length >= count ? hit : hit.concat(pool.filter((x) => !hit.includes(x)));
  }

  const picks: OccasionPick[] = pool
    .slice(0, count)
    .map((x) => ({ cookable: x.cookable, mealName: x.meal.name }));

  // Top up from the atlas when the curated set cannot fill the occasion.
  if (picks.length < count) {
    const world = dishes.filter(
      (d) => (plus || freeCountries.includes(d.country)) && !explored.has(d.country)
    );
    for (const dish of world) {
      if (picks.length >= count) break;
      if (picks.some((p) => p.dish?.id === dish.id)) continue;
      picks.push({ cookable: cookableForDish(dish, { loose: true }), dish });
    }
  }

  return picks.slice(0, count);
}
