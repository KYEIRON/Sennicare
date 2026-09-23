import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility, measured rather than asserted.
 *
 * Every page the public can reach — read from the sitemap, so a new page is
 * covered the day it is added — plus the sign-in page, scanned with axe against
 * WCAG 2.1 A and AA. Serious and critical violations fail the build.
 *
 * This matters for a delivery company in a specific way: customers book from
 * phones, sometimes in a hurry, sometimes with a screen reader, and a form that
 * cannot be completed is a job BOYD'S never hears about.
 */

async function publicUrls(page: Page): Promise<string[]> {
  const response = await page.request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]!).pathname,
  );
  expect(urls.length).toBeGreaterThan(10);
  return [...urls, '/sign-in'];
}

async function audit(page: Page, path: string) {
  await page.goto(path);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      page: path,
      rule: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));
}

test('every public page meets WCAG 2.1 AA with no serious or critical violations', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const urls = await publicUrls(page);
  const violations = [];

  for (const url of urls) {
    violations.push(...(await audit(page, url)));
  }

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});
