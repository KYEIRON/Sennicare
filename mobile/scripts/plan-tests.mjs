/**
 * V32.6 global planning rules, tested as behaviour rather than as UI.
 *
 *   npm run test:plan
 *
 * The store's planning logic is pure enough to exercise directly: a day holds a
 * recipe or a world discovery, discoveries are a Plus capability, moving never
 * overwrites, and calories only count what Nourish can actually count.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const build = mkdtempSync(join(tmpdir(), 'nourish-plan-'));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

try {
  execSync(
    `npx tsc src/lib/planning.ts --outDir ${build} --module commonjs --target es2020 ` +
      `--resolveJsonModule --esModuleInterop --skipLibCheck`,
    { cwd: root, stdio: 'inherit' }
  );

  const require = createRequire(import.meta.url);
  const { recordsById, discoveryRecords, recipeRecords } = require(join(build, 'lib', 'foodGraph.js'));
  const { meals } = require(join(build, 'lib', 'data.js'));
  const P = require(join(build, 'lib', 'planning.js'));

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /**
   * A thin harness over the real planning rules in src/lib/planning.ts — the
   * same functions the store calls, so these tests cannot drift from the app.
   */
  function makePlanner({ plus = false } = {}) {
    let week = {};
    return {
      week: () => week,
      plannedRecord: (day) => P.plannedRecord(week, day),
      occupied: (day) => P.planOccupied(week, day),
      count: () => P.plannedDaysCount(week),
      calories: () => P.plannedCalories(week),
      locked: (day) => P.dayIsLocked(week, day, plus),
      planMeal(index, day) {
        if (!P.canPlanMeal(week, day, plus)) return false;
        week = P.withMeal(week, day, index);
        return true;
      },
      planGlobal(id, day) {
        if (!P.canPlanGlobal(plus, id)) return false;
        week = P.withGlobal(week, day, id);
        return true;
      },
      move(from, to) {
        if (!P.canMove(week, from, to)) return false;
        week = P.withMove(week, from, to);
        return true;
      },
      remove(day) {
        week = P.withoutDay(week, day);
      },
    };
  }

  const someDiscovery = discoveryRecords.find((r) => r.country === 'Peru') || discoveryRecords[0];

  // Record ids the planner depends on.
  check('recipe records are addressable by plan id', Boolean(recordsById.get('recipe:0')));
  check('discovery records are addressable by plan id', Boolean(recordsById.get(someDiscovery.id)));

  // Free members can explore the world but not plan from it.
  const free = makePlanner({ plus: false });
  check('free · cannot plan a world discovery', free.planGlobal(someDiscovery.id, 'Monday') === false);
  check('free · can plan three recipe days',
    free.planMeal(0, 'Monday') && free.planMeal(1, 'Tuesday') && free.planMeal(2, 'Wednesday'));
  check('free · fourth day is gated', free.planMeal(3, 'Thursday') === false);
  check('free · replacing an existing day still works', free.planMeal(4, 'Monday') === true);

  // Plus members can plan from the whole atlas.
  const plus = makePlanner({ plus: true });
  check('plus · can plan a world discovery', plus.planGlobal(someDiscovery.id, 'Monday') === true);
  check('plus · the day reads back as that dish',
    plus.plannedRecord('Monday')?.title === someDiscovery.title,
    plus.plannedRecord('Monday')?.title);
  check('plus · a discovery day is a planned day', plus.count() === 1);
  check('plus · a discovery contributes no calories', plus.calories() === 0);

  plus.planMeal(0, 'Tuesday');
  check('plus · a recipe day does contribute calories', plus.calories() === meals[0].cal,
    `${plus.calories()} kcal`);
  check('a week can mix recipes and discoveries',
    plus.plannedRecord('Monday')?.kind === 'discovery' && plus.plannedRecord('Tuesday')?.kind === 'recipe');

  // Moving must never silently overwrite a day.
  check('move onto an occupied day is refused', plus.move('Monday', 'Tuesday') === false);
  check('move onto a free day works', plus.move('Monday', 'Friday') === true);
  check('move · the dish arrived', plus.plannedRecord('Friday')?.title === someDiscovery.title);
  check('move · the old day is now free', plus.occupied('Monday') === false);
  check('move from an empty day is refused', plus.move('Sunday', 'Saturday') === false);

  // Swapping a discovery for a recipe, and back.
  plus.planMeal(5, 'Friday');
  check('a discovery day can be swapped for a recipe', plus.plannedRecord('Friday')?.kind === 'recipe');
  plus.planGlobal(someDiscovery.id, 'Friday');
  check('and back again', plus.plannedRecord('Friday')?.kind === 'discovery');

  // Removing works for both kinds.
  plus.remove('Friday');
  check('a discovery day can be removed', plus.occupied('Friday') === false);

  check('free · locked days are reported as locked',
    makePlanner({ plus: false }) && (() => {
      const p = makePlanner({ plus: false });
      p.planMeal(0, 'Monday'); p.planMeal(1, 'Tuesday'); p.planMeal(2, 'Wednesday');
      return p.locked('Thursday') === true && p.locked('Monday') === false;
    })());

  check('plus · no day is ever locked', (() => {
    const p = makePlanner({ plus: true });
    DAYS.forEach((d, i) => p.planMeal(i, d));
    return DAYS.every((d) => p.locked(d) === false);
  })());

  check('a week with a discovery reports nutrition as pending', (() => {
    const p = makePlanner({ plus: true });
    p.planGlobal(someDiscovery.id, 'Monday');
    return P.weekHasDiscoveries(p.week()) === true;
  })());

  check('a recipe-only week does not', (() => {
    const p = makePlanner({ plus: true });
    p.planMeal(0, 'Monday');
    return P.weekHasDiscoveries(p.week()) === false;
  })());

  // Peru: not featured, still plannable.
  const peru = discoveryRecords.filter((r) => r.country === 'Peru');
  check('Peru dishes are plannable although Peru is not featured', peru.length > 0,
    peru.map((r) => r.title).join(', '));

  // The world planning pool is the whole atlas, not the featured set.
  check('world planning pool is the full atlas', discoveryRecords.length === 585,
    `${discoveryRecords.length} dishes`);
  check('recipes remain distinct from discoveries',
    recipeRecords.every((r) => r.kind === 'recipe') && discoveryRecords.every((r) => r.kind === 'discovery'));

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll planning scenarios passed.');
} finally {
  rmSync(build, { recursive: true, force: true });
}
