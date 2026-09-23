import { expect, test } from '@playwright/test';

/**
 * The private side of the system, from the outside.
 *
 * Row level security is the authoritative boundary and is tested against the
 * database. These tests check the layer a visitor meets first: every private
 * route turns a signed-out browser away, before any page renders, and search
 * engines are told not to index any of it.
 */

const PRIVATE_ROUTES = [
  '/command-centre',
  '/requests',
  '/jobs',
  '/dispatch',
  '/incidents',
  '/customers',
  '/crm',
  '/quotes',
  '/invoices',
  '/reports',
  '/vehicles',
  '/drivers',
  '/settings',
  '/assistant',
  '/driver/today',
  '/driver/record',
];

for (const route of PRIVATE_ROUTES) {
  test(`${route} sends a signed-out visitor to sign in`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/sign-in/);
  });
}

test('sign-in says plainly when it cannot work, rather than pretending', async ({
  page,
}) => {
  await page.goto('/command-centre');
  await expect(page.getByRole('status')).toContainText(/not been connected/i);
});

test('search engines are told to stay out of every private route', async ({
  request,
}) => {
  const robots = await (await request.get('/robots.txt')).text();
  for (const route of PRIVATE_ROUTES) {
    const top = `/${route.split('/')[1]}`;
    expect(robots, `robots.txt should disallow ${top}`).toContain(`Disallow: ${top}`);
  }
});

test('the sitemap lists no private route', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const route of PRIVATE_ROUTES) {
    expect(sitemap).not.toContain(`${route}<`);
    expect(sitemap).not.toContain(`${route}/`);
  }
});
