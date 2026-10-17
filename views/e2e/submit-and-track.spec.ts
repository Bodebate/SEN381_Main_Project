import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// E2E-01 | FR-REQ-001 submit a request, FR-REQ-002 track its status
test('E2E-01 requester submits a request and tracks it by its tracking ID', async ({ page }) => {
  // Arrange: a signed-in requester on the new-request form, with valid input
  const newRequest = {
    title: 'E2E burst pipe on Main Rd',
    details: 'Water has been running down the street since 07:00.',
    address: '12 Main Rd, Pretoria',
  };
  await signIn(page, 'requester');
  await page.getByRole('link', { name: '+ New request' }).first().click();

  // Act: submit the request, then open its tracking page
  await page.getByLabel('Title *').fill(newRequest.title);
  await page.getByLabel('Description *').fill(newRequest.details);
  await page.getByLabel('Location / address *').fill(newRequest.address);
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText('Request submitted')).toBeVisible(); // wait for the confirmation
  const trackingId = ((await page.locator('.tracking').textContent()) ?? '').trim();
  await page.getByRole('link', { name: 'Track it' }).click();

  // Assert: a tracking ID was issued and the tracking page shows the request as Submitted
  expect(trackingId).not.toBe('');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(newRequest.title);
  await expect(page.getByText(trackingId).first()).toBeVisible();
  await expect(page.getByText('Submitted').first()).toBeVisible();
});
