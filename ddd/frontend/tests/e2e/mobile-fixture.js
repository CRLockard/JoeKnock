export async function installMobileFixture(page) {
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
      path.endsWith('/interactions') &&
      route.request().method() === 'POST'
    ) {
      status = 503;
      body = {
        error: { code: 'UNAVAILABLE', message: 'Synthetic save failure' },
      };
    } else if (path.endsWith('/interactions'))
      body = { propertyId: 'mobile-property', interactions: [] };
    else {
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
}

export async function inspectMobilePanel(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('/map');
  await page.locator('.leaflet-marker-icon').first().click();
  const panel = page.getByRole('region', { name: 'Selected property panel' });
  await panel.waitFor();
  const bounds = await panel.boundingBox();
  if (bounds.y < 71 || bounds.y + bounds.height > viewport.height + 1)
    throw new Error('Property panel extends outside the usable viewport');
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
    await field.scrollIntoViewIfNeeded();
    const box = await field.boundingBox();
    if (box.y < 71 || box.y + box.height > viewport.height + 1)
      throw new Error(`${name} is not reachable`);
  }
  await page
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('mobile-status');
  await page
    .getByRole('button', { name: 'Save interaction', exact: true })
    .click();
  const message = panel.getByText(
    /The server could not complete this save right now/,
  );
  await message.waitFor();
  await message.scrollIntoViewIfNeeded();
  const errorBounds = await message.boundingBox();
  if (
    errorBounds.y < 71 ||
    errorBounds.y + errorBounds.height > viewport.height + 1
  )
    throw new Error('Save error is not reachable inside the panel');
  return { viewport, panel: bounds, error: errorBounds, fieldsReachable: true };
}
