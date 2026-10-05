import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('dashboard', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('shows the title', async ({ page }) => {
    await expect(page).toHaveTitle(/Dashboard/);
  });

  test('saves inside a step', async ({ page }) => {
    await test.step('submit the form', async () => {
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Saved')).toBeVisible();
    });
  });

  test('checks softly', { tag: '@smoke' }, async ({ page }) => {
    await expect.soft(page.getByRole('heading')).toHaveText('Dashboard');
  });
});
