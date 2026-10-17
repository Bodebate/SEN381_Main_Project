import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests for the Angular front end as it is today (mock data in the browser, no back end).
 * Playwright starts `ng serve` itself unless one is already running on port 4200.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0, // M3: a flaky test is a defect to fix, not something to rerun until it passes
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
