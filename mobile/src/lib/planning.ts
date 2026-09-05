import { DAYS, Day, meals } from './data';
import { FoodRecord, recordsById } from './foodGraph';

/**
 * Planning rules.
 *
 * V32.6 lets a day hold either a recipe from the Girki library or a food
 * discovery from the 195-country atlas. These are the rules for that, kept pure
 * and in one place so the store and the tests cannot drift apart.
 */

export type PlannedEntry =
  | { meal: number; globalId?: undefined; addedAt: string }
  | { globalId: string; meal?: undefined; addedAt: string };

export type Week = Partial<Record<Day, PlannedEntry>>;

/** Free planning covers three days of saved recipes. */
export const FREE_PLANNING_DAYS = 3;

export function plannedRecord(week: Week, day: Day): FoodRecord | null {
  const entry = week[day];
  if (!entry) return null;
  if (entry.meal !== undefined) return recordsById.get(`recipe:${entry.meal}`) || null;
  return recordsById.get(entry.globalId) || null;
}

export function plannedMealIndex(week: Week, day: Day): number | null {
  const entry = week[day];
  if (!entry || entry.meal === undefined) return null;
  return Number.isInteger(entry.meal) && meals[entry.meal] ? entry.meal : null;
}

export function planOccupied(week: Week, day: Day): boolean {
  return plannedRecord(week, day) !== null;
}

export function plannedDaysCount(week: Week): number {
  return DAYS.filter((day) => planOccupied(week, day)).length;
}

/** Only recipe-backed days contribute calories; a discovery has none to give. */
export function plannedCalories(week: Week): number {
  return DAYS.reduce((sum, day) => {
    const index = plannedMealIndex(week, day);
    return index === null ? sum : sum + (meals[index]?.cal || 0);
  }, 0);
}

/** True when a day holds a discovery, so the summary can say nutrition is pending. */
export function weekHasDiscoveries(week: Week): boolean {
  return DAYS.some((day) => plannedRecord(week, day)?.kind === 'discovery');
}

export function dayIsLocked(week: Week, day: Day, plus: boolean): boolean {
  return !plus && !planOccupied(week, day) && plannedDaysCount(week) >= FREE_PLANNING_DAYS;
}

export function canPlanMeal(week: Week, day: Day, plus: boolean): boolean {
  if (plus) return true;
  if (planOccupied(week, day)) return true;
  return plannedDaysCount(week) < FREE_PLANNING_DAYS;
}

/** Planning from the world atlas is a Girki+ capability. Exploring it is free. */
export function canPlanGlobal(plus: boolean, recordId: string): boolean {
  if (!plus) return false;
  const record = recordsById.get(recordId);
  return record?.kind === 'discovery';
}

/** Moving must never silently overwrite another day. */
export function canMove(week: Week, from: Day, to: Day): boolean {
  return from !== to && planOccupied(week, from) && !planOccupied(week, to);
}

export function withMeal(week: Week, day: Day, mealIndex: number): Week {
  return { ...week, [day]: { meal: mealIndex, addedAt: new Date().toISOString() } };
}

export function withGlobal(week: Week, day: Day, recordId: string): Week {
  return { ...week, [day]: { globalId: recordId, addedAt: new Date().toISOString() } };
}

export function withMove(week: Week, from: Day, to: Day): Week {
  const next: Week = { ...week, [to]: week[from] };
  delete next[from];
  return next;
}

export function withoutDay(week: Week, day: Day): Week {
  const next: Week = { ...week };
  delete next[day];
  return next;
}
