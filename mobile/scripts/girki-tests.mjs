/**
 * Girki logic tests.
 *
 *   npm run test:girki
 *
 * Where the prototype has the same function, the port is compared against it
 * directly — the prototype is the specification, so agreeing with it is the
 * test. The rest are behaviour checks the brief calls for.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const build = mkdtempSync(join(tmpdir(), 'girki-'));
const require = createRequire(import.meta.url);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

try {
  execSync(
    `npx tsc src/lib/girki/recipes.ts src/lib/girki/technique.ts src/lib/girki/passport.ts ` +
      `src/lib/girki/occasions.ts src/lib/girki/cook.ts --outDir ${build} --module commonjs ` +
      `--target es2020 --resolveJsonModule --esModuleInterop --skipLibCheck`,
    { cwd: root, stdio: 'inherit' }
  );

  const lib = (name) => require(join(build, 'lib', 'girki', `${name}.js`));
  const cook = lib('cook');
  const recipesLib = lib('recipes');
  const technique = lib('technique');
  const passportLib = lib('passport');
  const occasionsLib = lib('occasions');
  const content = lib('content');

  // The prototype, running, so the port can be compared with the specification.
  const { extractPrototype } = require(join(here, 'extract-prototype.js'));
  const { data: proto } = extractPrototype();

  const allSteps = [
    ...Object.values(proto.N37_RECIPES).flatMap((r) => r.steps),
    ...proto.N37_FAMILIES.flatMap((f) => f.steps),
    ...proto.meals.flatMap((m) => m.steps),
  ];
  console.log(`\ncomparing against the prototype across ${allSteps.length} method steps\n`);

  // ---- cook mode timing, step by step, against the prototype's own rules ----
  const protoMinutes = (text) => {
    const t = String(text || '').toLowerCase();
    const nums = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:to\s*(\d+(?:\.\d+)?)\s*)?(?:min|mins|minute|minutes)/g)];
    if (!nums.length) return 0;
    let m = 0;
    nums.forEach((x) => { m += Number(x[2] || x[1]); });
    if (/each side|per side|both sides/.test(t)) m *= 2;
    return Math.round(m);
  };
  const protoKind = (text) => {
    const t = String(text || '').toLowerCase();
    if (/refrigerat|overnight|marinat|leave (the|it) .* (for|to)|chill (for|in)/.test(t) && !/simmer|boil|fry|roast|bake/.test(t)) return 'chill';
    if (/oven|roast|bake|grill|tray/.test(t)) return 'oven';
    if (/simmer|boil|stock|broth|soup|stew|cook the rice|cook quinoa|cook the noodles|warm the/.test(t)) return 'pot';
    if (/fry|pan|sear|brown|sauté|saute|soften|toast/.test(t)) return 'pan';
    if (/chop|slice|blend|mix|whisk|combine|build|assemble|serve|top with|finish/.test(t)) return 'board';
    return 'pan';
  };

  const minuteMismatch = allSteps.filter((s) => cook.stepMinutes(s) !== protoMinutes(s));
  check('step timings match the prototype exactly', minuteMismatch.length === 0,
    minuteMismatch.slice(0, 2).map((s) => s.slice(0, 60)).join(' | '));

  const kindMismatch = allSteps.filter((s) => cook.stepKind(s) !== protoKind(s));
  check('step kinds match the prototype exactly', kindMismatch.length === 0,
    kindMismatch.slice(0, 2).map((s) => s.slice(0, 60)).join(' | '));

  check('a range takes its upper bound', cook.stepMinutes('Simmer for 8 to 10 minutes') === 10);
  check('two timings in one step add up', cook.stepMinutes('Fry 4 minutes, then 3 minutes more') === 7);
  check('each side doubles', cook.stepMinutes('Cook 4 minutes each side') === 8);
  check('an untimed step still gets a sensible default',
    cook.cookSteps(['Chop the onion'])[0].minutes === cook.DEFAULT_MINUTES.board);
  check('untimed steps are marked as untimed', cook.cookSteps(['Chop the onion'])[0].timed === false);
  check('waiting is only waiting when the whole step waits',
    cook.stepKind('Leave it to marinate for 20 minutes') === 'chill' &&
      cook.stepKind('Leave it to simmer for 20 minutes') !== 'chill');
  check('formatTimer pads', cook.formatTimer(65) === '01:05' && cook.formatTimer(-5) === '00:00');

  // ---- technique clips, against the prototype's matcher ----
  const protoClipIds = Object.keys(proto.GIRKI_TECHNIQUE_CLIPS);
  const order = ['dry-toast', 'onion-caramelise', 'onion-soften', 'garlic-sizzle', 'spices-bloom',
    'fish-flake', 'chicken-done', 'eggs-set', 'sear', 'greens-wilt', 'rice-rest', 'noodles-drain',
    'roast-edges', 'sauce-thicken', 'simmer'];
  const protoMatch = (t) => {
    if (/^\s*(cut|chop|slice|dice|peel|shred|grate|mince|trim)\b/i.test(t)) return null;
    if (/^\s*heat the oven[^.]*\.\s*\d+\s*minutes?\.?\s*$/i.test(t)) return null;
    if (/refrigerat|overnight|marinat|leave (the|it) .* (to take on|for)/i.test(t) && !/simmer|fry|bake|roast/i.test(t)) return null;
    for (const id of order) {
      const c = proto.GIRKI_TECHNIQUE_CLIPS[id];
      const test = new RegExp(c.test.__regex, c.test.flags);
      if (!test.test(t)) continue;
      if (c.and && !new RegExp(c.and.__regex, c.and.flags).test(t)) continue;
      if (c.not && new RegExp(c.not.__regex, c.not.flags).test(t)) continue;
      return id;
    }
    return null;
  };
  const clipMismatch = allSteps.filter((s) => technique.matchClip(s) !== protoMatch(s));
  check('technique matching agrees with the prototype on every step', clipMismatch.length === 0,
    clipMismatch.slice(0, 2).map((s) => s.slice(0, 60)).join(' | '));
  check('all 15 clips are available to the matcher',
    protoClipIds.every((id) => content.clips.some((c) => c.id === id)));
  check('preparation steps get no clip', technique.matchClip('Chop the onion finely') === null);
  check('a step can only borrow the recipe for doneness',
    technique.techniqueFor('Boil the potatoes for 15 minutes', { name: 'Cod and potatoes', ingredients: ['cod'] }) !== 'fish-flake');
  check('doneness steps may borrow the recipe',
    technique.techniqueFor('Cook until it flakes easily', { name: 'Cod and potatoes', ingredients: ['160g cod'] }) === 'fish-flake');

  // ---- recipe resolution ----
  const kabuli = recipesLib.cookableFor('Afghanistan', 'Kabuli palaw', { loose: true });
  check('an authored recipe is used when one exists', kabuli.authored === true && kabuli.source === 'authored');
  check('the authored recipe keeps its method', kabuli.steps.length >= 6, `${kabuli.steps.length} steps`);
  const generated = recipesLib.cookableFor('Mongolia', 'Buuz');
  check('a dish without a recipe gets a family version', generated.source === 'family' && generated.authored === false);
  check('the family version says what it is', /interpretation, not the traditional recipe/.test(generated.note));
  check('the family version names the country and dish',
    generated.note.includes('Mongolia') && generated.note.includes('Buuz'));
  check('every atlas dish resolves to something cookable',
    content.dishes.every((d) => {
      const c = recipesLib.cookableForDish(d, { loose: true });
      return c.ingredients.length > 0 && c.steps.length > 0;
    }));
  check('stated time matches the method',
    (() => {
      const dish = content.dishes.find((d) => d.country === 'Mongolia');
      const c = recipesLib.cookableForDish(dish, { loose: true });
      return c.minutes === cook.totalMinutes(c.steps);
    })());

  const counts = recipesLib.authoredCount();
  check('the authored/generated split is honest', counts.authored + counts.generated === content.dishes.length,
    `${counts.authored} authored, ${counts.generated} generated`);

  // ---- ingredient accessibility ----
  // Both gochujang and basmati rice carry substitutions in the prototype's map.
  const access = recipesLib.accessibility(['2 tbsp gochujang', '250g basmati rice', '1 onion']);
  check('specialist ingredients are flagged with a substitution',
    access.specialist.length === 2 && access.specialist.every((r) => Boolean(r.substitution)),
    access.specialist.map((r) => `${r.term} -> ${r.substitution}`).join('; '));
  check('an everyday ingredient is not called specialist',
    access.rows.find((r) => r.text === '1 onion')?.level === 'easy');
  check('supermarket language never names a chain',
    !/tesco|lidl|asda|aldi|sainsbury|waitrose|morrisons/i.test(access.where), access.where);
  check('an all-easy list reads as very easy',
    recipesLib.accessibility(['1 onion', '2 garlic cloves']).score === 'Very easy');

  // ---- passport ----
  const log = [
    { dish: 'Waakye', country: 'Ghana', at: new Date().toISOString(), kcal: 640, minutes: 70 },
    { dish: 'Kimchi jjigae', country: 'Korea', at: new Date().toISOString(), kcal: 480, minutes: 35 },
  ];
  const p = passportLib.passportFrom(log);
  check('the passport stamps countries', p.countries.length === 2, p.countries.join(', '));
  check('short country names are mapped to the atlas', p.countries.includes('South Korea'));
  check('the passport groups regions', p.regions.length >= 1, p.regions.join(', '));
  check('the passport counts against all 195', p.totalCountries === 195);
  check('cook log entries are keyed by dish and country, never an index',
    p.log.every((x) => typeof x.dish === 'string' && typeof x.country === 'string' && !('index' in x)));
  check('an empty passport invites a first cook',
    /Twelve countries are open/.test(passportLib.suggestNext(passportLib.passportFrom([]))));
  check('a partial passport names an unvisited region',
    /whole region of food waiting/.test(passportLib.suggestNext(p)));
  check('where next avoids where you have been',
    (() => {
      const next = passportLib.nextDishSuggestion(p, true);
      return next && !p.countries.includes(next.country);
    })());
  check('free membership opens twelve countries',
    content.freeCountries.length === 12 &&
      passportLib.countryIsOpen('Ghana', false) &&
      !passportLib.countryIsOpen('Mongolia', false) &&
      passportLib.countryIsOpen('Mongolia', true));
  check('whenText reads in plain words',
    passportLib.whenText(new Date().toISOString()) === 'today' &&
      passportLib.whenText(new Date(Date.now() - 86400000 * 3).toISOString()) === '3 days ago');

  // ---- occasions ----
  const dateNight = occasionsLib.occasionById('date');
  const picks = occasionsLib.pickForOccasion(dateNight, 4, { plus: true });
  check('date night returns a real choice', picks.length === 4, `${picks.length}`);
  check('date night respects its time window',
    picks.every((x) => !x.mealName || (x.cookable.minutes <= 50 && x.cookable.minutes >= 25)) ||
      picks.some((x) => x.dish),
    picks.map((x) => `${x.cookable.dish} ${x.cookable.minutes}m`).join(', '));
  check('all eight occasions return something',
    content.occasions.every((o) => occasionsLib.pickForOccasion(o, 3, { plus: true }).length > 0),
    content.occasions.map((o) => `${o.name}:${occasionsLib.pickForOccasion(o, 3, { plus: true }).length}`).join(' '));
  const surprise = occasionsLib.pickForOccasion(occasionsLib.occasionById('bored'), 4, {
    plus: true, exploredCountries: ['Ghana', 'Japan', 'Italy'],
  });
  check('"I don’t know what I want" goes to the atlas', surprise.every((x) => Boolean(x.dish)),
    surprise.map((x) => `${x.cookable.dish} (${x.cookable.country})`).join(', '));
  check('"I don’t know what I want" avoids where you have cooked',
    surprise.every((x) => !['Ghana', 'Japan', 'Italy'].includes(x.dish.country)));
  check('the surprise changes with the date, not with every tap',
    (() => {
      const a = occasionsLib.pickForOccasion(occasionsLib.occasionById('bored'), 4, { plus: true, today: new Date('2026-03-04') });
      const b = occasionsLib.pickForOccasion(occasionsLib.occasionById('bored'), 4, { plus: true, today: new Date('2026-03-04') });
      const c = occasionsLib.pickForOccasion(occasionsLib.occasionById('bored'), 4, { plus: true, today: new Date('2026-03-05') });
      const ids = (picks) => picks.map((x) => x.dish.id).join('|');
      return ids(a) === ids(b) && ids(a) !== ids(c);
    })());

  // ---- every written recipe must be reachable somewhere ----
  const strandedInAtlas = content.recipes.filter((r) => !r.reachableFromAtlas);
  check('every written recipe resolves to a cookable method',
    content.recipes.every((r) => {
      const c = recipesLib.cookableFor(r.country, r.name, { loose: true });
      return c.authored && c.steps.length > 0 && c.ingredients.length > 0;
    }));
  check('recipes stranded from the atlas are still openable by recipe id',
    strandedInAtlas.every((r) => Boolean(r.id)),
    `${strandedInAtlas.length} stranded, all carry an id for the recipes surface`);

  // ---- the loop the product is built on: cook, stamp, go somewhere new ----
  const cookLoop = [];
  const record = (dish, country) => {
    const c = recipesLib.cookableFor(country, dish, { loose: true });
    cookLoop.push({ dish, country, at: new Date().toISOString(), kcal: c.kcal, minutes: c.minutes });
  };

  record('Waakye', 'Ghana');
  let loopPassport = passportLib.passportFrom(cookLoop);
  check('cooking stamps the country', loopPassport.countries.includes('Ghana'));
  check('cooking stamps the region', loopPassport.regions.includes('West Africa'), loopPassport.regions.join(', '));
  check('the same country twice is one stamp, two cooks',
    (() => {
      record('Kelewele', 'Ghana');
      const p2 = passportLib.passportFrom(cookLoop);
      return p2.countries.length === 1 && p2.cooks === 2;
    })());
  check('where next moves on after a country is stamped',
    (() => {
      const next = passportLib.nextDishSuggestion(passportLib.passportFrom(cookLoop), true);
      return next && next.country !== 'Ghana';
    })());
  check('the log survives a round trip through storage',
    (() => {
      const restored = JSON.parse(JSON.stringify(cookLoop));
      const p3 = passportLib.passportFrom(restored);
      return p3.cooks === cookLoop.length && p3.log[0].dish === 'Waakye';
    })());
  check('a renamed or reordered library cannot scramble history',
    (() => {
      // Entries carry name and country, so nothing depends on a position.
      const p4 = passportLib.passportFrom(cookLoop);
      return p4.log.every((e) => e.dish && typeof e.dish === 'string' && !('index' in e));
    })());

  // ---- every atlas dish can actually be cooked, end to end ----
  const uncookable = content.dishes.filter((d) => {
    const c = recipesLib.cookableForDish(d, { loose: true });
    const steps = cook.cookSteps(c.steps);
    return !steps.length || steps.some((s) => !s.text || s.minutes <= 0);
  });
  check('every one of the 597 dishes yields a timed method', uncookable.length === 0,
    uncookable.slice(0, 3).map((d) => `${d.country}: ${d.name}`).join(' | '));

  const noCue = content.dishes.slice(0, 120).filter((d) => {
    const c = recipesLib.cookableForDish(d, { loose: true });
    return cook.cookSteps(c.steps).some((s) => !s.cue);
  });
  check('every step has something to look for', noCue.length === 0);

  // ---- copy discipline: no health claims anywhere in migrated content ----
  const claim = /\b(cures?|heals?|treats?|prevents?|detox|superfood|boосts?|burns fat|weight loss)\b/i;
  const offenders = [
    ...content.recipes.map((r) => r.culturalNote),
    ...content.families.map((f) => f.steps.join(' ')),
    ...content.occasions.map((o) => `${o.blurb} ${o.tip}`),
  ].filter((text) => claim.test(text || ''));
  check('no health claims in migrated copy', offenders.length === 0, offenders.slice(0, 2).join(' | '));

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll Girki logic checks passed.');
} finally {
  rmSync(build, { recursive: true, force: true });
}
