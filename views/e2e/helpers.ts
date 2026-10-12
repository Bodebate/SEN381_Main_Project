import { expect, Page } from '@playwright/test';

/** Signs in through the real login form. The demo accounts all use the password "demo". */
export async function signIn(page: Page, username: string, password = 'demo'): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
