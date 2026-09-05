/**
 * Parity check: runs the V28 prototype's own JavaScript next to the app's
 * ported logic and asserts they agree.
 *
 *   npm run parity
 *
 * This is the guard rail for "do not redesign Nourish": if a rule here drifts
 * from the prototype, the check fails.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const prototypePath = join(root, '..', 'ios', 'prototype', 'Nourish_Global_Experience_V28.html');

const html = readFileSync(prototypePath, 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const lines = js.split('\n');

// The prototype's data block, plus the three pure helpers we depend on.
const dataBlock = lines.slice(0, 339).join('\n');
const helpers = [lines[444], lines[445], lines[452]].join('\n');

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
    function v28Filter(term){const q=String(term).toLowerCase();return meals.map((m,i)=>({m,i})).filter(({m})=>{const text=\`\${m.name} \${m.meta} \${m.fit||''} \${m.ingredients.join(' ')} \${(m.fits||[]).join(' ')}\`.toLowerCase();return text.includes(q)||(q==='under 30 minutes'&&m.duration<=30)||(q==='high fibre'&&text.includes('fibre'))}).map(x=>x.i);}
    function v28Today(slot,offset,plus){const arr=meals.map((m,i)=>[m,i]).filter(([m])=>m.slot===slot);return [...arr].sort((a,b)=>((a[1]+offset)%meals.length)-((b[1]+offset)%meals.length)).slice(0,plus?8:4).map(x=>x[1]);}
    return { meals, WORLD_COUNTRIES, setPantry, smartMatches, ingredientBase, v28Filter, v28Today };
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

  const terms = ['Spicy', 'Vegan friendly', 'Keto friendly', 'Kidney aware', 'High fibre', 'Under 30 minutes',
    'Easy tonight', 'Something plant based', 'Fish', 'Chicken', 'Meat', 'Something light', 'Comforting',
    'High protein', 'Use what I have', 'Something new'];
  check(
    `filterFood across ${terms.length} terms`,
    terms.every(
      (term) =>
        JSON.stringify(prototype.v28Filter(term)) ===
        JSON.stringify(ported.filterMeals(term).map((r) => r.index))
    )
  );

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

  if (failures.length) {
    console.error(`\n${failures.length} parity check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll parity checks passed — the app matches V28.');
} finally {
  rmSync(build, { recursive: true, force: true });
}
