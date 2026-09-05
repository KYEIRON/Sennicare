/**
 * The shopping list.
 *
 * The brief asks for combined quantities, minus what is already in the pantry.
 * Two recipes wanting 250g and 300g of rice should read as one line of 550g,
 * not two lines you have to add up in the aisle.
 *
 * Anything that cannot be parsed with confidence is kept exactly as written.
 * A wrong quantity is worse than an uncombined one.
 */

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'tbsp' | 'tsp' | 'clove' | 'tin' | 'item';

export type ParsedIngredient = {
  /** The line as written. */
  text: string;
  /** The ingredient without quantity, unit or preparation note. */
  name: string;
  quantity: number | null;
  unit: Unit | null;
  /** "finely chopped", "cut into 2cm cubes" — kept, never merged. */
  note: string;
};

const UNIT_WORDS: [RegExp, Unit][] = [
  [/^(kg|kilograms?)$/i, 'kg'],
  [/^(g|grams?|gram)$/i, 'g'],
  [/^(ml|millilitres?|milliliters?)$/i, 'ml'],
  [/^(l|litres?|liters?)$/i, 'l'],
  [/^(tbsp|tablespoons?)$/i, 'tbsp'],
  [/^(tsp|teaspoons?)$/i, 'tsp'],
  [/^(cloves?)$/i, 'clove'],
  [/^(tins?|cans?)$/i, 'tin'],
];

/** Units that can be added together only within their own family. */
const FAMILY: Record<Unit, string> = {
  g: 'mass', kg: 'mass', ml: 'volume', l: 'volume',
  tbsp: 'spoon', tsp: 'spoon', clove: 'count', tin: 'count', item: 'count',
};

function unitFor(word: string): Unit | null {
  for (const [pattern, unit] of UNIT_WORDS) if (pattern.test(word)) return unit;
  return null;
}

/** "A handful of", "2 large" — words that carry no arithmetic. */
const SIZE_WORDS = /^(small|large|medium|whole|ripe|fresh|dried|ground|good|generous)$/i;

export function parseIngredient(text: string): ParsedIngredient {
  const raw = String(text || '').trim();
  const [beforeComma, ...rest] = raw.split(',');
  const note = rest.join(',').trim();

  // A leading number, optionally with a unit: "250g rice", "2 tbsp oil", "1 onion".
  const match = beforeComma.match(/^(\d+(?:[./]\d+)?)\s*([a-zà-ÿ]+)?\s*(.*)$/i);
  if (!match) return { text: raw, name: beforeComma.trim().toLowerCase(), quantity: null, unit: null, note };

  const [, amount, maybeUnit, remainder] = match;
  const quantity = amount.includes('/')
    ? Number(amount.split('/')[0]) / Number(amount.split('/')[1])
    : Number(amount);
  if (!Number.isFinite(quantity)) {
    return { text: raw, name: beforeComma.trim().toLowerCase(), quantity: null, unit: null, note };
  }

  const unit = maybeUnit ? unitFor(maybeUnit) : null;
  let name = unit || !maybeUnit ? remainder : `${maybeUnit} ${remainder}`;
  // "2 large onions" — the size word belongs to the name, not the maths.
  if (maybeUnit && !unit && SIZE_WORDS.test(maybeUnit)) name = `${maybeUnit} ${remainder}`;

  return {
    text: raw,
    name: name.trim().toLowerCase().replace(/\s+/g, ' '),
    quantity,
    unit: unit || 'item',
    note,
  };
}

export type ShoppingLine = {
  /** What to write on the list. */
  text: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  /** Which dishes asked for it. */
  from: string[];
  /** True when several entries were added together. */
  combined: boolean;
};

const PLURAL = (name: string) => name.replace(/s$/, '');

/** Singular and plural of the same thing are the same thing. */
function key(parsed: ParsedIngredient): string {
  const base = PLURAL(parsed.name.replace(/\b(finely|roughly|thinly)\b/g, '').trim());
  return `${base}|${parsed.unit ? FAMILY[parsed.unit] : 'none'}`;
}

function format(quantity: number, unit: Unit | null, name: string): string {
  const rounded = Math.round(quantity * 100) / 100;
  if (!unit || unit === 'item') return `${rounded} ${name}`.trim();
  if (unit === 'clove') return `${rounded} ${rounded === 1 ? 'clove' : 'cloves'} ${name}`.trim();
  if (unit === 'tin') return `${rounded} ${rounded === 1 ? 'tin' : 'tins'} ${name}`.trim();
  return `${rounded}${unit} ${name}`.trim();
}

/** Normalise to the family's base unit so 1kg and 250g can be added. */
function toBase(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  if (unit === 'kg') return { quantity: quantity * 1000, unit: 'g' };
  if (unit === 'l') return { quantity: quantity * 1000, unit: 'ml' };
  return { quantity, unit };
}

/** Back to the friendlier unit once totalled. */
function fromBase(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  if (unit === 'g' && quantity >= 1000) return { quantity: quantity / 1000, unit: 'kg' };
  if (unit === 'ml' && quantity >= 1000) return { quantity: quantity / 1000, unit: 'l' };
  return { quantity, unit };
}

export type ShoppingInput = { dish: string; ingredients: string[] };

/**
 * Combine several dishes into one list, leaving out anything the pantry
 * already covers.
 */
export function buildShoppingList(
  inputs: ShoppingInput[],
  pantry: string[] = [],
  options: { pantryHas?: (ingredient: string) => boolean } = {}
): ShoppingLine[] {
  const has = options.pantryHas
    || ((ingredient: string) => {
      const base = parseIngredient(ingredient).name;
      return pantry.some((item) => {
        const p = item.toLowerCase().trim();
        return p.length > 2 && (base.includes(p) || p.includes(base));
      });
    });

  const lines = new Map<string, ShoppingLine & { unit: Unit | null }>();

  for (const input of inputs) {
    for (const ingredient of input.ingredients) {
      if (has(ingredient)) continue;
      const parsed = parseIngredient(ingredient);
      const id = key(parsed);
      const existing = lines.get(id);

      if (!existing) {
        lines.set(id, {
          text: parsed.text,
          name: parsed.name,
          quantity: parsed.quantity,
          unit: parsed.unit,
          from: [input.dish],
          combined: false,
        });
        continue;
      }

      if (!existing.from.includes(input.dish)) existing.from.push(input.dish);

      // Only add up when both sides parsed into the same family of units.
      if (existing.quantity !== null && parsed.quantity !== null && existing.unit && parsed.unit) {
        const a = toBase(existing.quantity, existing.unit);
        const b = toBase(parsed.quantity, parsed.unit);
        if (a.unit === b.unit) {
          const total = fromBase(a.quantity + b.quantity, a.unit);
          existing.quantity = total.quantity;
          existing.unit = total.unit;
          existing.text = format(total.quantity, total.unit, existing.name);
          existing.combined = true;
          continue;
        }
      }
      // Different units, or nothing to add: keep the clearer of the two lines.
      existing.combined = true;
      existing.text = existing.quantity === null ? parsed.text : existing.text;
    }
  }

  return [...lines.values()].map(({ unit, ...line }) => ({ ...line, unit }));
}

/** What one dish still needs, given the pantry. */
export function missingFor(
  ingredients: string[],
  pantryHas: (ingredient: string) => boolean
): string[] {
  return ingredients.filter((i) => !pantryHas(i));
}
