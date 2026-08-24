import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A standing guard, not a one-off check.
 *
 * The BOYD'S dashboard mockup is a visual design reference. Its figures are
 * illustrative placeholders. This test fails the build if any of them appear in
 * runtime source, because a figure copied from a mockup into a component is one
 * short step from a seed file and then from a partner's decision.
 *
 * Ronald's instruction, 2026-08-24: "Never allow illustrative data to appear as
 * real operational data."
 */

const SRC = join(process.cwd(), 'src');

/** Figures and identifiers that appear in the visual design reference. */
const MOCKUP_VALUES: readonly { pattern: RegExp; what: string }[] = [
  { pattern: /1,?240\.00/, what: 'mockup revenue $1,240.00' },
  { pattern: /812\.45/, what: 'mockup contribution $812.45' },
  { pattern: /427\.55/, what: 'mockup total costs $427.55' },
  { pattern: /362\.45/, what: 'mockup summary contribution $362.45' },
  { pattern: /46\.32/, what: 'mockup fuel cost $46.32' },
  { pattern: /\$5\.21/, what: 'mockup contribution per mile $5.21' },
  { pattern: /3\.74\s*\/?\s*gal/i, what: 'mockup fuel price $3.74/gal' },
  { pattern: /\b156\s*mi\b/i, what: "mockup today's miles 156 mi" },
  { pattern: /18\.6\s*MPG/i, what: 'mockup fuel economy 18.6 MPG' },
  { pattern: /JOB-2025-\d{4}/, what: 'mockup job number' },
  { pattern: /REQ-2025-\d{4}/, what: 'mockup request number' },
  { pattern: /Ford\s+Transit/i, what: 'mockup vehicle model' },
  { pattern: /\(?704\)?[\s.-]?555[\s.-]?\d{4}/, what: 'mockup phone number' },
  { pattern: /12\.4\s*gal/i, what: 'mockup fuel volume 12.4 gal' },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry) ? [full] : [];
  });
}

describe('the dashboard mockup is a visual reference, not a data source', () => {
  const files = sourceFiles(SRC);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(MOCKUP_VALUES)('no runtime source contains $what', ({ pattern }) => {
    const offenders = files
      .filter((file) => pattern.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('no source file seeds a customer, driver or partner name as data', () => {
    // Moh and Ronald are real partners and are referenced in UI copy, which is
    // correct. What must not appear is an invented customer or contact.
    const invented = /Pharmaceutical Delivery|Lab Specimens|Medical Equipment/i;
    const offenders = files
      .filter((file) => invented.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
