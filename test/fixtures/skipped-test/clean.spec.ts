import { expect, test } from '@playwright/test';

test('exports on every browser but WebKit', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Downloads are not supported on WebKit');
  await expect(page.getByText('Export')).toBeVisible();
});

test.describe('slow flows', () => {
  test.skip(({ browserName }) => browserName === 'firefox', 'Flaky on Firefox');
  test.fixme();

  test('checks out', async ({ page }) => {
    await expect(page.getByText('Thank you')).toBeVisible();
  });
});
