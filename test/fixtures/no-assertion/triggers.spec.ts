import { test } from '@playwright/test';

// Strict by design: actions that would throw if the page were broken are not assertions.
test('saves the profile', async ({ page }) => {
  await page.goto('/profile');
  await page.getByLabel('Name').fill('Ada');
  await page.getByRole('button', { name: 'Save' }).click();
});
