/**
 * The brief's human test scenarios, run as assertions.
 *
 *   npm run test:engine
 *
 * These check the thing that matters: that Nourish searches the world rather
 * than the featured rail, that it stays diverse, that it respects safety, and
 * that a follow-up refines the previous answer instead of starting again.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const build = mkdtempSync(join(tmpdir(), 'nourish-engine-'));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

try {
  execSync(
    `npx tsc src/lib/discovery.ts src/lib/conversation.ts --outDir ${build} --module commonjs ` +
      `--target es2020 --resolveJsonModule --esModuleInterop --skipLibCheck`,
    { cwd: root, stdio: 'inherit' }
  );

  const require = createRequire(import.meta.url);
  const { discover, planDay, pantryMatches, EMPTY_CONTEXT } = require(join(build, 'lib', 'discovery.js'));
  const { graphStats } = require(join(build, 'lib', 'foodGraph.js'));
  const { parseIntent, refineIntent } = require(join(build, 'lib', 'intent.js'));
  const { Conversation } = require(join(build, 'lib', 'conversation.js'));

  const context = (over = {}) => ({ ...EMPTY_CONTEXT, ...over });
  const countriesOf = (result) =>
    [...new Set([...result.recipes, ...result.discoveries].map((r) => r.record.country))];
  const titlesOf = (result) => [...result.recipes, ...result.discoveries].map((r) => r.record.title);

  console.log(
    `\ngraph: ${graphStats.recipes} recipes + ${graphStats.discoveries} discovery records ` +
      `across ${graphStats.atlasCountries} atlas countries\n`
  );

  // TEST 1 — "I want more fish": many countries, not only featured.
  const fish = discover('I want more fish', context(), { limit: 8, discoveryLimit: 8 });
  const fishCountries = countriesOf(fish);
  check('1. fish · searches beyond featured', fish.discoveries.length >= 5, `${fish.discoveries.length} atlas dishes`);
  check('1. fish · global variety', fishCountries.length >= 6, `${fishCountries.length} places: ${fishCountries.slice(0, 8).join(', ')}`);
  check(
    '1. fish · no single culture dominates',
    Math.max(...Object.values(fishCountries.reduce((acc, c) => ({ ...acc, [c]: (acc[c] || 0) + 1 }), {}))) <= 2
  );
  check('1. fish · every result is fish', [...fish.recipes, ...fish.discoveries].every((r) => r.record.tags.includes('fish')));

  // TEST 2 — breakfast ideas from around the world.
  const breakfast = discover('Give me breakfast ideas', context(), { limit: 6, discoveryLimit: 8 });
  check('2. breakfast · global', countriesOf(breakfast).length >= 5, countriesOf(breakfast).slice(0, 8).join(', '));
  check(
    '2. breakfast · correct slot',
    [...breakfast.recipes, ...breakfast.discoveries].every((r) => r.record.slots.includes('Breakfast'))
  );

  // TEST 3 — pantry-first.
  const pantry = context({ pantry: ['Rice', 'Spinach', 'Tomatoes', 'Chickpeas'] });
  const pantryResult = discover('I have rice, spinach, tomatoes and chickpeas', pantry, { limit: 5 });
  check('3. pantry · ranks what you own first', pantryResult.recipes[0]?.have.length >= 2,
    `${pantryResult.recipes[0]?.record.title} uses ${pantryResult.recipes[0]?.have.length}`);
  check('3. pantry · explains what is missing', pantryResult.recipes[0]?.reasons.some((r) => r.kind === 'shopping' || r.kind === 'pantry'));
  const matches = pantryMatches(pantry, 3);
  check('3. pantry · smart kitchen agrees', matches[0].have.length >= 2, `${matches[0].record.title}: ${matches[0].have.length} have, ${matches[0].need.length} need`);

  // TEST 4 — something new, given a discovery history.
  const explored = context({ exploredCountries: ['Japan', 'Italy', 'Ghana', 'India', 'France', 'Mexico'] });
  const fresh = discover('Give me something new', explored, { limit: 6, discoveryLimit: 6 });
  check('4. something new · avoids explored countries',
    !countriesOf(fresh).some((c) => explored.exploredCountries.includes(c)),
    countriesOf(fresh).slice(0, 6).join(', '));

  // TEST 5 — compound: fish + lunch + time.
  const quickFish = discover('I want fish for lunch under 20 minutes', context(), { limit: 6, discoveryLimit: 6 });
  const quickAll = [...quickFish.recipes, ...quickFish.discoveries];
  check('5. fish + lunch + time · all fish', quickAll.every((r) => r.record.tags.includes('fish')));
  check('5. fish + lunch + time · all lunch capable', quickAll.every((r) => r.record.slots.includes('Lunch')));
  check('5. fish + lunch + time · recipes respect 20 minutes',
    quickFish.recipes.every((r) => (r.record.minutes ?? 0) <= 20),
    quickFish.recipes.map((r) => `${r.record.title} ${r.record.minutes}m`).join('; ') || 'no recipe matches');
  check('5. fish + lunch + time · still diverse', countriesOf(quickFish).length >= 4, countriesOf(quickFish).join(', '));

  // TEST 6 — a continent, not one country.
  const africa = discover('I want something from Africa', context(), { limit: 4, discoveryLimit: 10 });
  const africaCountries = countriesOf(africa);
  check('6. Africa · many African countries', africaCountries.length >= 6, africaCountries.slice(0, 10).join(', '));
  check('6. Africa · not only Ghana', !(africaCountries.length === 1 && africaCountries[0] === 'Ghana'));

  // TEST 7 — plan a day.
  const day = planDay(context({ pantry: ['Rice', 'Eggs', 'Spinach'] }));
  check('7. plan · three meals', day.slots.filter((s) => s.recommendation).length === 3);
  check('7. plan · varied cultures', new Set(day.countries).size >= 2, day.countries.join(', '));
  check('7. plan · reports shopping and pantry', Array.isArray(day.shoppingNeeded) && Array.isArray(day.pantryUsed),
    `${day.pantryUsed.length} pantry items used, ${day.shoppingNeeded.length} to buy`);
  const slotsCorrect = day.slots.every((s) => !s.recommendation || s.recommendation.record.slots.includes(s.slot));
  check('7. plan · right meal in the right slot', slotsCorrect);

  // TEST 8 — a dietary exclusion.
  const noEggs = discover("I don't eat eggs, give me breakfast", context(), { limit: 6, discoveryLimit: 8 });
  const eggy = [...noEggs.recipes, ...noEggs.discoveries].filter((r) =>
    /\begg/i.test(`${r.record.title} ${r.record.ingredients.join(' ')}`)
  );
  check('8. no eggs · excluded from results', eggy.length === 0, eggy.map((r) => r.record.title).join(', '));

  // TEST 9 — allergy safety.
  const nutAllergy = context({ allergies: ['Tree nuts', 'Peanuts'] });
  const nutty = discover('Something with nuts please', nutAllergy, { limit: 6, discoveryLimit: 6 });
  const unsafe = [...nutty.recipes, ...nutty.discoveries].filter((r) =>
    r.containsAllergens.some((a) => ['Tree nuts', 'Peanuts'].includes(a))
  );
  check('9. allergy · nothing containing the allergen', unsafe.length === 0);
  check('9. allergy · exclusions are counted', nutty.excludedForAllergies > 0, `${nutty.excludedForAllergies} records filtered`);
  check('9. allergy · discovery records flagged as un-checked',
    nutty.discoveries.every((r) => r.allergenUnknown === true));
  const fishAllergy = discover('fish dinner', context({ allergies: ['Fish'] }), { limit: 6, discoveryLimit: 6 });
  check('9. allergy · fish allergy removes fish dishes',
    ![...fishAllergy.recipes, ...fishAllergy.discoveries].some((r) => r.record.allergens.includes('Fish')));

  // TEST 10 — culture question routes to a cultural intent, not a recipe.
  check('10. culture · recognised as a culture question', parseIntent('Tell me the history of this dish').kind === 'culture');

  // Conversation: refine without repeating.
  const chat = new Conversation();
  const first = chat.ask('I want more fish', context({ pantry: ['Rice', 'Spinach', 'Lemon'] }));
  check('conv · first turn returns fish', first.result.recipes.concat(first.result.discoveries).every((r) => r.record.tags.includes('fish')));
  const second = chat.ask('which ones use what I have?', context({ pantry: ['Rice', 'Spinach', 'Lemon'] }));
  check('conv · follow-up keeps fish', second.intent.tags.includes('fish'), `tags: ${second.intent.tags.join(', ')}`);
  check('conv · follow-up adds pantry', second.intent.wantsPantry === true);
  const third = chat.ask('make them lunches', context());
  check('conv · third turn keeps fish and adds lunch',
    third.intent.tags.includes('fish') && third.intent.slots.includes('Lunch'),
    `slots: ${third.intent.slots.join(', ')}`);
  const fourth = chat.ask('nothing spicy', context());
  check('conv · exclusion applies and persists',
    fourth.intent.excludeTags.includes('spicy') &&
      !fourth.result.recipes.concat(fourth.result.discoveries).some((r) => r.record.tags.includes('spicy')));
  const fifth = chat.ask('give me the easiest three', context());
  check('conv · count and difficulty understood',
    fifth.intent.count === 3 && fifth.intent.difficulty === 'easy' && fifth.intent.tags.includes('fish'));

  // Intent parsing details.
  check('intent · "20 minute lunch" reads the time', parseIntent('20 minute lunch').maxMinutes === 20);
  check('intent · "breakfast from India" reads the country', parseIntent('breakfast from India').countries.includes('India'));
  check('intent · "plan tomorrow" is a plan', parseIntent('plan tomorrow').kind === 'plan');
  check('intent · "use my pantry" is a pantry request', parseIntent('use my pantry').wantsPantry === true);
  check('intent · refinement keeps the original subject',
    refineIntent(parseIntent('I want more fish'), 'and make it quick').tags.includes('fish'));

  // Featured is not the universe.
  const featuredOnly = discover('fish', context(), { limit: 30, discoveryLimit: 30 });
  check('featured is not the universe',
    featuredOnly.discoveries.length > featuredOnly.recipes.length,
    `${featuredOnly.recipes.length} recipes vs ${featuredOnly.discoveries.length} atlas dishes`);

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll engine scenarios passed.');
} finally {
  rmSync(build, { recursive: true, force: true });
}
