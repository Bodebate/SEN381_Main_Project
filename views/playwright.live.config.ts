import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests against the REAL Express API (npm run e2e:live).
 * Playwright starts two servers of its own, isolated from your normal ones:
 *  - the API on port 3100 with a throwaway in-memory MongoDB and demo accounts (scripts/start-test-api.js)
 *  - the Angular app on port 4300 in the "e2e" configuration, which calls that API
 * Nothing touches Atlas, your .env database or the servers on ports 3000/4200.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  outputDir: 'test-results-live',
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../scripts/start-test-api.js',
      url: 'http://localhost:3100/api/health',
      reuseExistingServer: false,
      timeout: 180_000, // the first run downloads a MongoDB binary
    },
    {
      command: 'npx ng serve -c e2e',
      url: 'http://localhost:4300',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
