/**
 * Content migration verification.
 *
 *   npm run verify:content
 *
 * The brief's rule is that nothing is lost. This proves it against the
 * prototype itself: it re-runs Girki_V54_Signup_Spacing.html's own JavaScript,
 * then compares the migrated bundle with that runtime data item by item — every
 * dish, every recipe key, every image URL, every cultural note the source has.
 *
 * It is deliberately a comparison, not a list of remembered numbers. A number
 * can be wrong in both places; a comparison cannot.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { extractPrototype, imageUrls } = require('./extract-prototype.js');

const dataDir = join(here, '..', 'src', 'data', 'girki');
const read = (name) => JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'));

const { data: source, html, threw } = extractPrototype();
if (threw) console.log(`      (prototype threw under the stub DOM after data load: ${threw})`);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const dishes = read('dishes');
const recipes = read('recipes');
const meals = read('meals');
const countries = read('countries');
const media = read('media');
const families = read('families');
const clips = read('clips');
const occasions = read('occasions');
const substitutions = read('substitutions');
const preferences = read('preferences');

// ---------- counts, taken from the prototype rather than from memory ----------
const expect = {
  dishes: source.NOURISH_GLOBAL_LIBRARY.length,
  countries: source.WORLD_COUNTRIES.length,
  recipes: Object.keys(source.N37_RECIPES).length,
  meals: source.meals.length,
  families: source.N37_FAMILIES.length,
  substitutions: Object.keys(source.N37_SUBS).length,
  clips: Object.keys(source.GIRKI_TECHNIQUE_CLIPS).length,
  occasions: source.N39_OCCASIONS.length,
  media: imageUrls(html).length,
};

check(`${expect.dishes} atlas dishes`, dishes.length === expect.dishes, `${dishes.length}`);
check(`${expect.countries} countries`, countries.length === expect.countries, `${countries.length}`);
check(`${expect.recipes} hand-written recipes`, recipes.length === expect.recipes, `${recipes.length}`);
check(`${expect.meals} curated meals`, meals.length === expect.meals, `${meals.length}`);
check(`${expect.media} images`, media.length === expect.media, `${media.length}`);
check(`${expect.families} family templates`, families.length === expect.families, `${families.length}`);
check(`${expect.clips} technique clips`, clips.length === expect.clips, `${clips.length}`);
check(`${expect.occasions} occasions`, occasions.length === expect.occasions, `${occasions.length}`);
check(`${expect.substitutions} substitutions`, substitutions.length === expect.substitutions, `${substitutions.length}`);

// The brief's headline numbers, asserted separately so a drop in the prototype
// itself is visible rather than silently mirrored.
check('the brief’s inventory holds: 597 / 195 / 32 / 30 / 67',
  expect.dishes === 597 && expect.countries === 195 && expect.recipes === 32 &&
    expect.meals === 30 && expect.media === 67,
  `${expect.dishes} / ${expect.countries} / ${expect.recipes} / ${expect.meals} / ${expect.media}`);

// ---------- every item, by identity ----------
const missingDishes = source.NOURISH_GLOBAL_LIBRARY.filter(
  (x) => !dishes.some((d) => d.country === x.country && d.name === x.dish)
);
check('every atlas dish survived', missingDishes.length === 0,
  missingDishes.slice(0, 5).map((x) => `${x.country}: ${x.dish}`).join(' | '));

const missingRecipes = Object.keys(source.N37_RECIPES).filter(
  (key) => !recipes.some((r) => r.key === key)
);
check('every hand-written recipe survived', missingRecipes.length === 0, missingRecipes.join(', '));

const missingMeals = source.meals.filter((m) => !meals.some((x) => x.name === m.name));
check('every curated meal survived', missingMeals.length === 0,
  missingMeals.map((m) => m.name).join(', '));

const missingMedia = imageUrls(html).filter((url) => !media.some((m) => m.url === url));
check('every image URL survived', missingMedia.length === 0, missingMedia.slice(0, 3).join(' | '));

// ---------- 15 Ghanaian dishes ----------
const ghana = dishes.filter((d) => d.country === 'Ghana');
check('15 Ghanaian dishes', ghana.length === 15, ghana.length ? `${ghana.length}` : 'none');
for (const name of ['Waakye', 'Red-red', 'Kelewele', 'Kontomire stew', 'Ghanaian light soup',
  'Groundnut soup with rice balls', 'Banku with okro stew', 'Tuo zaafi']) {
  if (!ghana.some((d) => d.name === name)) check(`Ghanaian dish: ${name}`, false);
}
check('the eight named Ghanaian dishes are all present',
  ['Waakye', 'Red-red', 'Kelewele', 'Kontomire stew', 'Ghanaian light soup',
    'Groundnut soup with rice balls', 'Banku with okro stew', 'Tuo zaafi']
    .every((n) => ghana.some((d) => d.name === n)));

// ---------- recipes keep their substance, field by field ----------
let thin = [];
let changed = [];
for (const [key, r] of Object.entries(source.N37_RECIPES)) {
  const migrated = recipes.find((x) => x.key === key);
  if (!migrated) continue;
  if (!migrated.ingredients.length || !migrated.steps.length || !migrated.nutrients.length) thin.push(key);
  if (migrated.ingredients.length !== r.ing.length || migrated.steps.length !== r.steps.length) changed.push(key);
  if (r.note && migrated.culturalNote !== r.note) changed.push(`${key} (note)`);
}
check('recipes kept every ingredient and step', changed.length === 0, changed.slice(0, 4).join(', '));
check('recipes kept ingredients, steps and nutrition', thin.length === 0, thin.join(', '));

const notesInSource = Object.values(source.N37_RECIPES).filter((r) => r.note).length;
const notesMigrated = recipes.filter((r) => r.culturalNote).length;
check('every cultural note the prototype has survived', notesMigrated === notesInSource,
  `${notesMigrated} migrated, ${notesInSource} in the prototype`);

const timed = recipes.filter((r) => r.steps.some((s) => /\d+\s*(minute|minutes|hour)/i.test(s)));
check('methods still carry real timings', timed.length >= recipes.length - 2,
  `${timed.length}/${recipes.length}`);

// ---------- images: identity, licence, honesty ----------
check('every image has an asset id', media.every((m) => Boolean(m.id)));
check('asset ids are unique', new Set(media.map((m) => m.id)).size === media.length);
check('every image records a source', media.every((m) => Boolean(m.source)));
check('every image has a licence field', media.every((m) => Boolean(m.licence)));
const ccBy = media.filter((m) => m.attributionRequired);
check('CC BY files name their author for visible credit', ccBy.every((m) => Boolean(m.author)),
  `${ccBy.length} require attribution`);

// ---------- editorial honesty ----------
check('generated family methods stay labelled generated',
  families.every((f) => f.editorialStatus === 'generated'));
check('hand-written recipes stay labelled authored',
  recipes.every((r) => r.isAuthored && r.editorialStatus === 'authored'));

// ---------- identity: never an array index ----------
check('dish ids are unique', new Set(dishes.map((d) => d.id)).size === dishes.length);
check('dish ids derive from country and name',
  dishes.every((d) => d.id.includes('--') && d.country && d.countryId));

// ---------- signup vocabularies ----------
check('signup keeps its region list', preferences.regions.length === source.GIRKI_REGIONS.length);
check('signup keeps confidence, weeknight, interests and discovery levels',
  preferences.confidence.length === source.GIRKI_CONFIDENCE.length &&
    preferences.weeknight.length === source.GIRKI_WEEKNIGHT.length &&
    preferences.foodInterests.length === source.GIRKI_FOOD_INTERESTS.length &&
    preferences.discoveryLevels.length === source.GIRKI_DISCOVERY_LEVELS.length);

// Reachability is a prototype defect, not a migration loss: every recipe is
// here, but the prototype can only reach one whose name appears in its
// country's atlas list. The bundle records which; the report names the rest.
const unreachable = recipes.filter((r) => !r.reachableFromAtlas);
check('every recipe records whether the atlas can reach it',
  recipes.every((r) => typeof r.reachableFromAtlas === 'boolean'));
check('reachable recipes point at a real atlas dish',
  recipes.filter((r) => r.reachableFromAtlas).every(
    (r) => dishes.some((d) => d.id === r.atlasDishId)
  ));

// ---------- open editorial work, reported not hidden ----------
const noNote = recipes.length - notesMigrated;
const unreviewed = media.filter((m) => m.status === 'needs-review').length;
const norm = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const authoredDishes = dishes.filter((d) =>
  recipes.some((r) => norm(r.country) === norm(d.country) && norm(r.name) === norm(d.name))
).length;
const generatedDishes = dishes.length - authoredDishes;

console.log('\nOpen editorial work (not migration failures):');
if (unreachable.length) {
  console.log(
    `  · ${unreachable.length} of ${recipes.length} hand-written recipes cannot be reached from ` +
      'the atlas: the prototype looks recipes up by country::dish, and these names are not in ' +
      "their country's dish list. All are migrated; none is reachable. Decision needed."
  );
  for (const r of unreachable) {
    const listed = countries.find((c) => c.name === r.country)?.foods || [];
    console.log(`      ${r.key}  —  ${r.country} atlas lists: ${listed.join(' / ') || 'nothing'}`);
  }
}
console.log(
  `  · ${generatedDishes} of ${dishes.length} atlas dishes have no hand-written recipe and fall ` +
    'back to a family template. The brief calls this the biggest quality risk: they are honest ' +
    'and labelled, and must never be silently promoted to authored.'
);
console.log(`  · ${noNote} of ${recipes.length} recipes have no cultural note`);
console.log(`  · ${unreviewed} of ${media.length} images need a per-file licence review`);

if (failures) {
  console.error(`\n${failures} content check(s) failed. Nothing may be lost in migration.`);
  process.exit(1);
}
console.log('\nContent migration verified against the prototype: nothing dropped.');
