import { expect, test } from '@playwright/test';

test.fixme('exports the report', async ({ page }) => {
  await expect(page.getByText('Export')).toBeVisible();
});

test.describe.skip('billing', () => {
  test('shows invoices', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible();
  });
});
