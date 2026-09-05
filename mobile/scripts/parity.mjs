/**
 * Parity check: runs the V32.6 prototype's own JavaScript next to the app's
 * ported logic and asserts they agree.
 *
 *   npm run parity
 *
 * This is the guard rail for "do not redesign Nourish". It covers the parts the
 * app inherits verbatim: the food data, the image URLs, the country atlas, and
 * the kitchen rules (pantry matching, ingredient normalisation, the daily
 * rotation).
 *
 * It deliberately does NOT lock the recommendation ranking to the prototype's.
 * V32.5/6 rank with a flat score, one dish per country and a random tie-break;
 * the app's engine ranks over the whole food graph with hard constraints,
 * pantry and shopping weighting, novelty and a diversity pass. That divergence
 * is the point of the global intelligence work, and it is covered by
 * `npm run test:engine` instead.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const prototypePath = join(root, '..', 'docs', 'prototypes', 'Nourish_V32.6_Global_Planning_Intelligence.html');

const html = readFileSync(prototypePath, 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const lines = js.split('\n');

// The prototype's data block, plus the three pure helpers we depend on.
// Data constants, then the three pure kitchen helpers the app inherits.
const dataBlock = lines.slice(0, 425).join('\n');
const helperNames = ['function ingredientBase', 'function pantryHas', 'function smartMatches'];
const helpers = helperNames
  .map((name) => lines.find((line) => line.trim().startsWith(name)))
  .join('\n');

const build = mkdtempSync(join(tmpdir(), 'nourish-parity-'));
try {
  execSync(
    `npx tsc src/lib/logic.ts src/lib/data.ts --outDir ${build} --module commonjs ` +
      `--target es2020 --resolveJsonModule --esModuleInterop --skipLibCheck`,
    { cwd: root, stdio: 'inherit' }
  );

  const require = createRequire(import.meta.url);
  const ported = require(join(build, 'lib', 'logic.js'));
  const portedData = require(join(build, 'lib', 'data.js'));

  const prototype = new Function(`
    ${dataBlock}
    ${helpers}
    let pantry = [];
    function setPantry(items) { pantry = items; }
    function v28Today(slot,offset,plus){const arr=meals.map((m,i)=>[m,i]).filter(([m])=>m.slot===slot);return [...arr].sort((a,b)=>((a[1]+offset)%meals.length)-((b[1]+offset)%meals.length)).slice(0,plus?8:4).map(x=>x[1]);}
    return { meals, WORLD_COUNTRIES, WORLD_FREE_FEATURED, setPantry, smartMatches, ingredientBase, v28Today };
  `)();

  const failures = [];
  const check = (name, ok) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
    if (!ok) failures.push(name);
  };

  const pantry = ['Onions', 'Tinned tomatoes', 'Chickpeas', 'Rice', 'Spinach', 'Eggs', 'Greek yoghurt', 'Lentils'];
  prototype.setPantry(pantry);

  check(
    'smartMatches',
    JSON.stringify(prototype.smartMatches().map((x) => `${x.m.name}|${x.score.toFixed(6)}|${x.missing.length}`)) ===
      JSON.stringify(ported.smartMatches(pantry).map((x) => `${x.meal.name}|${x.score.toFixed(6)}|${x.missing.length}`))
  );

  // V32.5 hands the Food chips to the AI layer, so there is no prototype
  // `filterFood` predicate left to compare against. The engine's behaviour for
  // those chips is asserted in scripts/engine-tests.mjs.

  let rotationOk = true;
  for (let offset = 0; offset < prototype.meals.length; offset += 1) {
    for (const slot of ['Breakfast', 'Lunch', 'Dinner']) {
      for (const plus of [false, true]) {
        if (
          JSON.stringify(prototype.v28Today(slot, offset, plus)) !==
          JSON.stringify(ported.todaysMeals(slot, offset, plus).map((r) => r.index))
        ) {
          rotationOk = false;
        }
      }
    }
  }
  check(`daily rotation across all ${prototype.meals.length} offsets`, rotationOk);

  check(
    'ingredientBase across every ingredient',
    prototype.meals.every((m) =>
      m.ingredients.every((ing) => prototype.ingredientBase(ing) === ported.ingredientBase(ing))
    )
  );

  check(
    'meal images match the prototype exactly',
    JSON.stringify(prototype.meals.map((m) => m.img)) ===
      JSON.stringify(portedData.meals.map((m) => m.img))
  );

  check(
    'country atlas matches the prototype exactly',
    JSON.stringify(prototype.WORLD_COUNTRIES.map((c) => c[0])) ===
      JSON.stringify(portedData.countries.map((c) => c.name))
  );

  check(
    'featured set matches the prototype (Peru out of featured, still in the atlas)',
    JSON.stringify(prototype.WORLD_FREE_FEATURED) === JSON.stringify(portedData.freeFeatured) &&
      portedData.countries.some((c) => c.name === 'Peru') &&
      !portedData.freeFeatured.includes('Peru')
  );

  if (failures.length) {
    console.error(`\n${failures.length} parity check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll parity checks passed — the app matches V32.6.');
} finally {
  rmSync(build, { recursive: true, force: true });
}
