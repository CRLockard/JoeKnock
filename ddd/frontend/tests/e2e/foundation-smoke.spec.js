import { test, expect } from '@playwright/test';

test('frontend foundation shell renders', async ({ page }) => {
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { name: 'JoeKnock Foundation' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});
