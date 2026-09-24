import { expect, test } from '@playwright/test';

/**
 * The public request form — the only route a customer has to BOYD'S.
 *
 * Run against the app with no database connected, which is also what a
 * customer meets during a database outage. The form must say plainly that
 * nothing was sent, must not invent a way to reach the business, and must not
 * throw away what the customer typed.
 */

/** The form's own message — not Next.js's hidden route announcer, also an alert. */
function formAlert(page: import('@playwright/test').Page) {
  return page.locator('form [role="alert"]');
}

async function fillValidRequest(page: import('@playwright/test').Page) {
  await page.getByLabel(/^Your name\b/).fill('A Test Customer');
  await page.getByLabel(/^Email\b/).fill('customer@example.test');
  await page
    .getByLabel(/^Address\b/)
    .first()
    .fill('1 Test Street');
  await page
    .getByLabel(/^Address\b/)
    .nth(1)
    .fill('2 Test Avenue');
}

test.describe('when the request cannot be recorded', () => {
  test('says nothing was sent, and does not claim the request was received', async ({
    page,
  }) => {
    await page.goto('/request-a-delivery');
    await fillValidRequest(page);
    await page
      .getByRole('button', { name: /send|request/i })
      .last()
      .click();

    const alert = formAlert(page);
    await expect(alert).toContainText('nothing has been sent');
    await expect(page.getByText(/received|reference|we have your request/i)).toHaveCount(
      0,
    );
  });

  test('does not tell the customer to call a number the site does not publish', async ({
    page,
  }) => {
    await page.goto('/request-a-delivery');
    await fillValidRequest(page);
    await page
      .getByRole('button', { name: /send|request/i })
      .last()
      .click();

    await expect(formAlert(page)).toBeVisible();
    await expect(formAlert(page)).not.toContainText(/call us/i);
  });

  test('keeps everything the customer typed', async ({ page }) => {
    await page.goto('/request-a-delivery');
    await fillValidRequest(page);
    await page.getByRole('textbox', { name: /^Company/ }).fill('A Test Company');
    await page
      .getByRole('button', { name: /send|request/i })
      .last()
      .click();

    await expect(formAlert(page)).toBeVisible();
    await expect(page.getByLabel(/^Your name\b/)).toHaveValue('A Test Customer');
    await expect(page.getByLabel(/^Email\b/)).toHaveValue('customer@example.test');
    await expect(page.getByRole('textbox', { name: /^Company/ })).toHaveValue(
      'A Test Company',
    );
    await expect(page.getByLabel(/^Address\b/).first()).toHaveValue('1 Test Street');
    await expect(page.getByLabel(/^Address\b/).nth(1)).toHaveValue('2 Test Avenue');
  });
});

test.describe('when the customer misses a required field', () => {
  test('says which field, and keeps everything else they typed', async ({ page }) => {
    await page.goto('/request-a-delivery');
    // Everything except their name.
    await page.getByLabel(/^Email\b/).fill('customer@example.test');
    await page
      .getByLabel(/^Address\b/)
      .first()
      .fill('1 Test Street');
    await page
      .getByLabel(/^Address\b/)
      .nth(1)
      .fill('2 Test Avenue');
    await page.getByLabel(/^Describe it\b/).fill('Two boxes of test parts');
    await page
      .getByRole('button', { name: /send|request/i })
      .last()
      .click();

    await expect(page.getByLabel(/^Your name\b/)).toBeVisible();
    await expect(page.locator('form')).toContainText(/name/i);
    await expect(page.getByLabel(/^Email\b/)).toHaveValue('customer@example.test');
    await expect(page.getByLabel(/^Address\b/).first()).toHaveValue('1 Test Street');
    await expect(page.getByLabel(/^Describe it\b/)).toHaveValue(
      'Two boxes of test parts',
    );
  });
});
