import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// E2E-02 | NFR-SEC-001 role-based access (negative / unauthorised behaviour)
test('E2E-02 a requester who opens the staff queue is shown Access denied', async ({ page }) => {
  // Arrange: signed in as a requester (not staff)
  await signIn(page, 'requester');

  // Act: open a staff-only page directly
  await page.goto('/staff/queue');

  // Assert: the route guard sends them to Access denied
  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});

// E2E-03 | NFR-SEC-001 signed-out access (negative)
test('E2E-03 a signed-out visitor is sent to sign in', async ({ page }) => {
  // Arrange: nothing to set up; each test starts in a fresh, signed-out browser

  // Act: open a page that needs an account
  await page.goto('/requests');

  // Assert: the visitor is sent to the sign-in page
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
