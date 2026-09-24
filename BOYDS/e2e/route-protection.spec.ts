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
  '/team',
  '/assistant',
  '/account/password',
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

test.describe('invitation and reset links', () => {
  test('a link with no token is refused, with a plain explanation', async ({ page }) => {
    await page.goto('/auth/confirm?type=invite');
    await expect(page).toHaveURL(/\/sign-in\?reason=link-invalid/);
    await expect(page.locator('main [role="alert"]')).toContainText('not valid');
  });

  test('a sign-up link is refused — there is no self sign-up', async ({ page }) => {
    await page.goto('/auth/confirm?type=signup&token_hash=anything');
    await expect(page).toHaveURL(/\/sign-in\?reason=link-invalid/);
  });

  // Supabase's default templates (the only ones a free-tier project without its
  // own email provider may use) put the session in the URL fragment.
  test('a default-template link with no session in it is refused', async ({ page }) => {
    await page.goto('/auth/confirm');
    await expect(page).toHaveURL(/\/sign-in\?reason=link-invalid/);
  });

  test('a default-template sign-up link is refused — there is no self sign-up', async ({
    page,
  }) => {
    await page.goto('/auth/confirm#access_token=a&refresh_token=b&type=signup');
    await expect(page).toHaveURL(/\/sign-in\?reason=link-invalid/);
    expect(page.url()).not.toContain('access_token');
  });

  test('an expired default-template link says so', async ({ page }) => {
    await page.goto('/auth/confirm#error=access_denied&error_code=otp_expired');
    await expect(page).toHaveURL(/\/sign-in\?reason=link-expired/);

    await page.goto('/auth/confirm?error=access_denied&error_code=otp_expired');
    await expect(page).toHaveURL(/\/sign-in\?reason=link-expired/);
  });

  test('sign-in offers a way back in for a forgotten password', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(/\/sign-in\/reset/);
    await expect(
      page.getByRole('heading', { name: 'Forgot your password?' }),
    ).toBeVisible();
  });
});
