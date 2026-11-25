import { test, expect } from '@playwright/test';

test('selecting a map marker opens property workflow and interaction entry', async ({
  page,
}) => {
  // Route stubs keep this test focused on UI workflow transitions and guard
  // against backend dependency noise.
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

  let lookupCount = 0;
  const uncertainMessage =
    'We couldn’t identify a specific property here. Try tapping closer to the building.';
  await page.route('**/api/properties/resolve', async (route) => {
    lookupCount += 1;
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'PROPERTY_LOCATION_UNRESOLVABLE',
          message: uncertainMessage,
        },
      }),
    });
  });
  await page.route('**/*.tile.openstreetmap.org/**', (route) => route.abort());

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
  await expect(page.locator('.map-locate-button')).toBeVisible();

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByRole('link', { name: 'Map' })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation overlay' }).click();

  await page.getByRole('button', { name: /Rae Rep/i }).click();
  await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('.map-locate-button')).toBeVisible();
  await page.evaluate(() => {
    document.body.style.zoom = '1.15';
  });
  await expect(page.locator('.map-locate-button')).toBeVisible();
  await page.evaluate(() => {
    document.body.style.zoom = '1';
  });

  await marker.click();

  await expect(
    page.getByRole('heading', { name: 'Selected Property' }),
  ).toBeVisible();
  await expect(page.locator('.map-property-address')).toContainText(
    '123 Main St',
  );

  await expect(
    page.getByRole('heading', { name: 'Record Interaction' }),
  ).toBeVisible();

  await page.getByLabel('Notes').fill('Keep this draft.');
  await page.locator('.map-container').click({ position: { x: 60, y: 240 } });
  await expect(page.getByText(uncertainMessage)).toBeVisible();
  await expect(page.locator('.map-property-address')).toContainText(
    '123 Main St',
  );
  await expect(page.getByLabel('Notes')).toHaveValue('Keep this draft.');
  expect(lookupCount).toBe(1);

  await page
    .locator('form.map-interaction-form')
    .getByRole('button', { name: 'Cancel' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Selected Property' }),
  ).toHaveCount(0);
});
