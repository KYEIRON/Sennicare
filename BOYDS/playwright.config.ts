import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests through the real interface, in a real browser, against a
 * production build.
 *
 * The app is started WITHOUT Supabase configured. That is deliberate: it is the
 * state that proves the public site, the route protection and the honest
 * "not connected" states all work before any database exists. Signed-in
 * journeys need a Supabase project and live in the database integration tests
 * until one is available to test against.
 */

const PORT = 3100;

// Some environments ship a preinstalled Chromium that does not match this
// Playwright version's expected build. Use it when present; elsewhere,
// Playwright's own browser.
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...(existsSync(PREINSTALLED_CHROMIUM)
          ? { launchOptions: { executablePath: PREINSTALLED_CHROMIUM } }
          : {}),
      },
    },
    {
      // Moh uses the driver app on a phone; the public site is read on phones.
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        ...(existsSync(PREINSTALLED_CHROMIUM)
          ? { launchOptions: { executablePath: PREINSTALLED_CHROMIUM } }
          : {}),
      },
    },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // No Supabase variables: the app must work, honestly, without a database.
    env: { NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
  },
});
