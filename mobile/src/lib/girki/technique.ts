import { Clip, clips, pattern } from './content';

/**
 * Technique clips, matched to a step automatically.
 *
 * Ported from `n40Match` / `n40TechniqueFor`. The order matters: the more
 * specific technique wins, so caramelised onions are never labelled as softened
 * ones.
 */

const ORDER = [
  'dry-toast', 'onion-caramelise', 'onion-soften', 'garlic-sizzle', 'spices-bloom',
  'fish-flake', 'chicken-done', 'eggs-set', 'sear', 'greens-wilt', 'rice-rest',
  'noodles-drain', 'roast-edges', 'sauce-thicken', 'simmer',
];

type Compiled = { clip: Clip; test: RegExp; and: RegExp | null; not: RegExp | null };

const compiled = new Map<string, Compiled>(
  clips.map((clip) => [
    clip.id,
    {
      clip,
      test: pattern(clip.match, clip.matchFlags || 'i'),
      and: clip.and ? pattern(clip.and, 'i') : null,
      not: clip.not ? pattern(clip.not, 'i') : null,
    },
  ])
);

/** `n40Match` — the clip this step's own words earn, if any. */
export function matchClip(text: string): string | null {
  const t = String(text || '');
  // Preparation and waiting are not techniques worth filming.
  if (/^\s*(cut|chop|slice|dice|peel|shred|grate|mince|trim)\b/i.test(t)) return null;
  if (/^\s*heat the oven[^.]*\.\s*\d+\s*minutes?\.?\s*$/i.test(t)) return null;
  if (/refrigerat|overnight|marinat|leave (the|it) .* (to take on|for)/i.test(t) &&
      !/simmer|fry|bake|roast/i.test(t)) return null;

  for (const id of ORDER) {
    const entry = compiled.get(id);
    if (!entry) continue;
    if (!entry.test.test(t)) continue;
    if (entry.and && !entry.and.test(t)) continue;
    if (entry.not && entry.not.test(t)) continue;
    return id;
  }
  return null;
}

/**
 * `n40TechniqueFor` — the clip for a step, allowing the recipe to supply a
 * missing subject only where the step plainly describes cooking a protein to
 * doneness. Letting every step borrow the ingredient list made "boil the
 * potatoes" match the fish clip, which is worse than no clip.
 */
export function techniqueFor(
  text: string,
  meal?: { name?: string; ingredients?: string[] } | null
): string | null {
  const t = String(text || '');
  const own = matchClip(t);
  if (own) return own;
  if (!meal) return null;
  if (!/until (it|they|the)?\s*(is|are)?\s*(cooked|done|opaque|flakes?|no longer)|no pink|juices run|each side|cooked through|flakes easily/i.test(t)) {
    return null;
  }
  const context = matchClip(`${t} ${meal.name || ''} ${(meal.ingredients || []).join(' ')}`);
  return context === 'chicken-done' || context === 'fish-flake' ? context : null;
}

export function clipById(id: string): Clip | undefined {
  return compiled.get(id)?.clip;
}

/** `n40Coverage` — how much of a method the clips can illustrate. */
export function clipCoverage(steps: string[], meal?: { name?: string; ingredients?: string[] }) {
  const matched = steps.map((s) => techniqueFor(s, meal));
  return {
    matched: matched.filter(Boolean).length,
    total: steps.length,
    clips: matched,
  };
}
