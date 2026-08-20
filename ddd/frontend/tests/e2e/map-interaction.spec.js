import { test, expect } from '@playwright/test';

test('selecting a map marker opens property workflow and interaction entry', async ({
  page,
}) => {
  await page.route('**/api/map/properties**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          propertyId: 'property-1',
          latitude: 35.91,
          longitude: -84.05,
        },
      ]),
    });
  });

  await page.route('**/api/properties/property-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        propertyId: 'property-1',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Knoxville',
        state: 'TN',
        postalCode: '37901',
        country: 'US',
        latitude: 35.91,
        longitude: -84.05,
      }),
    });
  });

  await page.route(
    '**/api/properties/property-1/interactions',
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            propertyId: 'property-1',
            interactions: [],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          interactionId: 'interaction-1',
          interactionGroupId: 'group-1',
        }),
      });
    },
  );

  await page.route('**/api/statuses', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'status-1',
          name: 'Interested',
        },
      ]),
    });
  });

  await page.goto('/login');

  await page.evaluate(() => {
    localStorage.setItem('joeknock.jwt', 'test-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'rep-1',
        organizationId: 'org-1',
        role: 'rep',
        email: 'rep@example.com',
        firstName: 'Rae',
        lastName: 'Rep',
      }),
    );
  });

  await page.goto('/map');

  const marker = page.locator('.leaflet-marker-icon').first();
  await expect(marker).toBeVisible();
  await marker.click();

  await expect(
    page.getByRole('heading', { name: 'Selected Property' }),
  ).toBeVisible();
  await expect(page.getByText('123 Main St')).toBeVisible();

  await page.getByRole('button', { name: 'Start interaction' }).click();

  await expect(
    page.getByRole('heading', { name: 'Record Interaction' }),
  ).toBeVisible();

  await page
    .locator('form.map-interaction-form')
    .getByRole('button', { name: 'Cancel' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Selected Property' }),
  ).toBeVisible();
});
