import { expect } from '@playwright/test';

export async function installMobileFixture(
  page,
  { scenario = 'failure' } = {},
) {
  const requests = [];
  await page.addInitScript(() => {
    localStorage.setItem('joeknock.jwt', 'synthetic-mobile-session');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'mobile-rep',
        organizationId: 'mobile-org',
        role: 'rep',
        firstName: 'Mobile',
        lastName: 'Check',
      }),
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(success) {
          success({ coords: { latitude: 35.95, longitude: -84 } });
          return 1;
        },
        clearWatch() {},
      },
    });
  });
  await page.route('**/*.tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let body;
    let status = 200;
    if (path.endsWith('/map/properties'))
      body = [
        { propertyId: 'mobile-property', latitude: 35.95, longitude: -84 },
      ];
    else if (path.endsWith('/statuses'))
      body = [{ id: 'mobile-status', name: 'No Answer' }];
    else if (path.endsWith('/properties/mobile-property'))
      body = {
        propertyId: 'mobile-property',
        addressLine1: '123 Synthetic Street',
        city: 'Test City',
        state: 'TN',
        postalCode: '00000',
        latitude: 35.95,
        longitude: -84,
      };
    else if (
      path.endsWith('/properties/mobile-property/interactions') &&
      method === 'POST'
    ) {
      const payload = route.request().postDataJSON();
      requests.push(payload);
      if (scenario === 'same-day' && !payload.sameDayReturn) {
        status = 409;
        body = {
          error: { code: 'SAME_DAY_VISIT_EXISTS', message: 'Same day' },
        };
      } else if (scenario === 'same-day') {
        body = { interactionId: 'mobile-interaction' };
      } else {
        status = 503;
        body = {
          error: { code: 'UNAVAILABLE', message: 'Synthetic save failure' },
        };
      }
    } else if (path.endsWith('/properties/mobile-property/interactions'))
      body = {
        propertyId: 'mobile-property',
        interactions:
          scenario === 'edit'
            ? [
                {
                  interactionId: 'mobile-interaction',
                  interactionGroupId: 'mobile-group',
                  userId: 'mobile-rep',
                  statusName: 'No Answer',
                },
              ]
            : [],
      };
    else if (path.endsWith('/interactions/mobile-interaction')) {
      if (method === 'POST') {
        requests.push(route.request().postDataJSON());
        status = 503;
        body = {
          error: { code: 'UNAVAILABLE', message: 'Synthetic save failure' },
        };
      } else {
        body = {
          interactionId: 'mobile-interaction',
          interactionGroupId: 'mobile-group',
          propertyId: 'mobile-property',
          userId: 'mobile-rep',
          statusId: 'mobile-status',
          statusName: 'No Answer',
          notes: 'Original notes',
          changedAt: '2026-01-01T12:00:00Z',
        };
      }
    } else {
      status = 404;
      body = {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Synthetic route not configured',
        },
      };
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  return requests;
}

export async function expectReachable(locator, panel, viewport) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const bounds = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(Math.max(0, bounds.x) - 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(
    Math.min(viewport.width, bounds.x + bounds.width) + 0.5,
  );
  expect(box.y).toBeGreaterThanOrEqual(Math.max(0, bounds.y) - 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(
    Math.min(viewport.height, bounds.y + bounds.height) + 0.5,
  );
}

export async function expectPanelBounds(page, viewport) {
  const panel = page.getByRole('region', { name: 'Selected property panel' });
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  const stage = await page.locator('.map-stage').boundingBox();
  expect(bounds.x, 'panel left edge').toBeGreaterThanOrEqual(stage.x);
  expect(bounds.x + bounds.width, 'panel right edge').toBeLessThanOrEqual(
    stage.x + stage.width,
  );
  expect(bounds.x, 'viewport left edge').toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width, 'viewport right edge').toBeLessThanOrEqual(
    viewport.width,
  );
  expect(bounds.y, 'panel top edge').toBeGreaterThanOrEqual(stage.y);
  expect(bounds.y + bounds.height, 'panel bottom edge').toBeLessThanOrEqual(
    stage.y + stage.height,
  );
  expect(bounds.y, 'viewport top edge').toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height, 'viewport bottom edge').toBeLessThanOrEqual(
    viewport.height + 0.5,
  );
  const horizontalOverflow = await panel.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  return panel;
}

export async function inspectMobilePanel(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('/map');
  await page.locator('.leaflet-marker-icon').first().click();
  const panel = page.getByRole('region', { name: 'Selected property panel' });
  await panel.waitFor();
  if (process.env.JOEKNOCK_PANEL_SHOTS) {
    await page.screenshot({
      path: `${process.env.JOEKNOCK_PANEL_SHOTS}/${viewport.width}x${viewport.height}.png`,
    });
  }
  await expectPanelBounds(page, viewport);
  for (const name of [
    'Status',
    'Contact phone',
    'Contact name',
    'Contact email',
    'Notes',
  ]) {
    const field = page.getByRole(name === 'Status' ? 'combobox' : 'textbox', {
      name,
      exact: true,
    });
    await expectReachable(field, panel, viewport);
  }
  await page
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('mobile-status');
  await page.getByLabel('Notes').fill('Draft after failed save');
  const save = page.getByRole('button', {
    name: 'Save interaction',
    exact: true,
  });
  await expectReachable(save, panel, viewport);
  await save.click();
  const message = panel.getByText(
    /The server could not complete this save right now/,
  );
  await message.waitFor();
  await expectReachable(message, panel, viewport);
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  await expectReachable(cancel, panel, viewport);
}
