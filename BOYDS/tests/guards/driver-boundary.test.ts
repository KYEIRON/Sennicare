import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A standing guard on the driver surface.
 *
 * Business rules 28 and 29: a driver must never reach a price, a cost, a
 * contribution, a margin, a customer list, an invoice, a quote or a pricing
 * rule. Row level security enforces that at the database and the guards enforce
 * it on the server; this test enforces it in the source itself, so a financial
 * figure cannot be added to Moh's screens by accident.
 */

const DRIVER_APP = join(process.cwd(), 'src/app/(driver)');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

/**
 * Strip comments before scanning.
 *
 * The driver files legitimately DESCRIBE the boundary in their comments — "no
 * price, cost or contribution appears here". Scanning prose would flag the
 * documentation of the rule as a violation of it, so only code is checked.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = sourceFiles(DRIVER_APP).map((file) => ({
  path: relative(process.cwd(), file),
  content: stripComments(readFileSync(file, 'utf8')),
}));

describe('the driver app contains no financial surface', () => {
  it('finds the driver app', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each([
    ['won_price', /won_price/],
    ['quoted_price', /quoted_price/],
    ['cost columns', /_cost_(actual|estimated)_cents/],
    ['contribution', /contribution/i],
    ['margin', /\bmargin\b/i],
    ['formatCents', /formatCents/],
  ])('never references %s', (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never imports the profitability engine', () => {
    const offenders = files
      .filter((f) => f.content.includes('services/finance'))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never selects from the jobs table directly for reading', () => {
    // The driver app reads through driver_jobs, which has no financial column
    // in it. Writes go to `jobs` and are constrained by the column trigger.
    const readsJobsTable = files.filter((f) =>
      /\.from\('jobs'\)\s*\n?\s*\.select/.test(f.content),
    );
    expect(readsJobsTable.map((f) => f.path)).toEqual([]);
  });

  it('guards every driver server action with requireDriver', () => {
    const actionFiles = files.filter((f) => f.content.includes("'use server'"));
    expect(actionFiles.length).toBeGreaterThan(0);

    for (const file of actionFiles) {
      const exportedActions = file.content.match(/export async function \w+/g) ?? [];
      const guards = file.content.match(/requireDriver\(\)/g) ?? [];
      expect(guards.length).toBeGreaterThanOrEqual(exportedActions.length);
    }
  });
});
