import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

// CI requires this flag and starts a backend only after the test-target guard.
// Ordinary UI-only runs do not silently connect to a developer's database.
test.skip(
  process.env.JOEKNOCK_FULL_STACK !== '1',
  'Requires the guarded disposable-database full-stack environment.',
);

test('real signup API, browser login, profile and logout remain connected', async ({
  page,
  request,
}) => {
  const email = `full-stack-${randomUUID()}@example.com`;
  const password = 'Synthetic test password 123! ';
  const apiPort = process.env.JOEKNOCK_E2E_API_PORT || '3000';
  const response = await request.post(
    `http://127.0.0.1:${apiPort}/api/auth/register`,
    {
      data: {
        organizationName: 'Disposable CI organization',
        firstName: 'FullStack',
        lastName: 'Check',
        email,
        password,
        timezone: 'UTC',
      },
    },
  );
  expect(response.status()).toBe(201);
  // No public map/provider traffic is needed for this real-stack smoke check.
  await page.route('**/*.tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
  await page.goto('/profile');
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /FullStack Check/ }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
