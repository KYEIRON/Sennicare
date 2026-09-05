/**
 * Cook mode timing and guidance.
 *
 * Ported from the prototype's `n34*` functions. The timings are read out of the
 * method text itself, so a step that says "8 to 10 minutes" gets a ten minute
 * timer without anyone maintaining a second list of numbers.
 */

export type StepKind = 'board' | 'pan' | 'pot' | 'oven' | 'chill';

/** `N34_DEFAULTS` — what a step of each kind takes when it gives no timing. */
export const DEFAULT_MINUTES: Record<StepKind, number> = {
  board: 2, pan: 5, pot: 8, oven: 18, chill: 10,
};

/**
 * `n34StepMinutes` — minutes claimed by one step.
 *
 * A range takes its upper bound; separate timings in one step add up, because
 * "4 minutes, then 3 more" really is seven minutes of cooking.
 */
export function stepMinutes(text: string): number {
  const t = String(text || '').toLowerCase();
  const matches = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:to\s*(\d+(?:\.\d+)?)\s*)?(?:min|mins|minute|minutes)/g)];
  if (!matches.length) return 0;
  let total = 0;
  for (const m of matches) total += Number(m[2] || m[1]);
  if (/each side|per side|both sides/.test(t)) total *= 2;
  return Math.round(total);
}

/** `n34StepKind` — what the step is doing, which decides its illustration. */
export function stepKind(text: string): StepKind {
  const t = String(text || '').toLowerCase();
  // Waiting only counts as waiting when the whole step is waiting.
  if (/refrigerat|overnight|marinat|leave (the|it) .* (for|to)|chill (for|in)/.test(t) &&
      !/simmer|boil|fry|roast|bake/.test(t)) return 'chill';
  if (/oven|roast|bake|grill|tray/.test(t)) return 'oven';
  if (/simmer|boil|stock|broth|soup|stew|cook the rice|cook quinoa|cook the noodles|warm the/.test(t)) return 'pot';
  if (/fry|pan|sear|brown|sauté|saute|soften|toast/.test(t)) return 'pan';
  if (/chop|slice|blend|mix|whisk|combine|build|assemble|serve|top with|finish/.test(t)) return 'board';
  return 'pan';
}

/** `n34ChefCue` — the sentence that tells you what to look for, not just wait. */
export function chefCue(text: string, kind: StepKind): string {
  const t = String(text || '').toLowerCase();
  if (/until it flakes|until cooked through|fully cooked|thoroughly/.test(t)) {
    return 'Cook it through rather than to the clock. Fish flakes easily when it is done; chicken should have no pink and run clear.';
  }
  if (kind === 'pot' && /rice|quinoa|noodle|pasta/.test(t)) {
    return 'Bring it to the boil, then drop to a gentle simmer and put a lid on. Check a grain near the end rather than stirring constantly.';
  }
  if (kind === 'pot') return 'A steady, gentle bubble is what you want. A hard boil will reduce it too fast and can catch on the base.';
  if (kind === 'pan' && /onion|soften/.test(t)) return 'Medium heat, and let it go soft and translucent rather than brown. This is where the flavour starts.';
  if (kind === 'pan') return 'Get the pan hot before the food goes in, then leave it alone. Moving it too early is what makes things stick.';
  if (kind === 'oven') return 'Give everything room on the tray. Crowded vegetables steam instead of roasting.';
  if (kind === 'chill') return 'This part is waiting, not working. Set the timer and step away.';
  return 'Have everything cut and to hand before you start. Preparation is what makes cooking feel calm.';
}

export type CookStep = {
  index: number;
  text: string;
  kind: StepKind;
  /** Minutes read from the text, or the default for this kind of step. */
  minutes: number;
  /** True when the timing came from the method rather than a default. */
  timed: boolean;
  cue: string;
};

/** `n34Steps` — a method turned into timed, illustrated steps. */
export function cookSteps(steps: string[]): CookStep[] {
  return (steps || []).map((text, index) => {
    const kind = stepKind(text);
    const stated = stepMinutes(text);
    return {
      index,
      text,
      kind,
      minutes: stated || DEFAULT_MINUTES[kind],
      timed: stated > 0,
      cue: chefCue(text, kind),
    };
  });
}

/** Total cooking time implied by the method. */
export function totalMinutes(steps: string[]): number {
  return cookSteps(steps).reduce((sum, step) => sum + step.minutes, 0);
}

/** `n34Remaining` — minutes left from a given step onwards. */
export function remainingMinutes(steps: CookStep[], fromIndex: number): number {
  return steps.slice(fromIndex).reduce((sum, step) => sum + step.minutes, 0);
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
