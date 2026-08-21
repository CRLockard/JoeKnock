import { test, expect } from '@playwright/test';

test('frontend foundation shell renders', async ({ page }) => {
  // Smoke assertion ensures the routed shell and login entry point mount.
  await page.goto('/login');

  await expect(page.getByRole('link', { name: 'JoeKnock' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});
