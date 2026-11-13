import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';

test.skip(
  process.env.JOEKNOCK_FULL_STACK !== '1',
  'Requires the guarded disposable-database full-stack environment.',
);

const requireFromBackend = createRequire(
  new URL('../../../backend/package.json', import.meta.url),
);
const LAT = 35.9606;
const LNG = -83.9207;
const SHOT_DIR = process.env.JOEKNOCK_E2E_SHOTS;

async function shot(page, name) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

test.use({
  geolocation: { latitude: LAT, longitude: LNG },
  permissions: ['geolocation'],
});

test('log a visit, same-day return, later-day visit and prior-visit edit on the map', async ({
  page,
  request,
}) => {
  const { Client } = requireFromBackend('pg');
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();

  try {
    const email = `visit-flow-${randomUUID()}@example.com`;
    const password = 'Synthetic test password 123!';
    const apiPort = process.env.JOEKNOCK_E2E_API_PORT || '3000';
    const response = await request.post(
      `http://127.0.0.1:${apiPort}/api/auth/register`,
      {
        data: {
          organizationName: 'Visit flow organization',
          firstName: 'Visit',
          lastName: 'Flow',
          email,
          password,
          timezone: 'America/New_York',
        },
      },
    );
    expect(response.status()).toBe(201);

    const { rows: users } = await db.query(
      'SELECT id, organization_id FROM users WHERE email = $1',
      [email],
    );
    const orgId = users[0].organization_id;
    const { rows: existing } = await db.query(
      'SELECT 1 FROM statuses WHERE organization_id = $1',
      [orgId],
    );
    if (existing.length === 0) {
      await db.query(
        `INSERT INTO statuses (organization_id, name, display_order)
         VALUES ($1, 'Interested', 1), ($1, 'No Answer', 2)`,
        [orgId],
      );
    }
    const { rows: props } = await db.query(
      `INSERT INTO properties (organization_id, address_line_1, city, state,
         postal_code, country, normalized_address, latitude, longitude)
       VALUES ($1, '12 Test Lane', 'Knoxville', 'TN', '37901', 'US',
         $2, $3, $4) RETURNING id`,
      [orgId, `12 test lane knoxville tn ${randomUUID()}`, LAT, LNG],
    );
    const propertyId = props[0].id;
    const counts = async () => {
      const { rows } = await db.query(
        `SELECT
           (SELECT count(*)::int FROM interactions WHERE property_id = $1) AS snapshots,
           (SELECT count(*)::int FROM daily_knocks
             WHERE property_id = $1) AS knocks`,
        [propertyId],
      );
      return rows[0];
    };

    await page.route('**/*.tile.openstreetmap.org/**', (route) =>
      route.abort(),
    );
    // Only the geocoder is stubbed so no public provider is contacted.
    await page.route('**/api/properties/resolve', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          created: false,
          property: { propertyId, latitude: LAT, longitude: LNG },
        }),
      }),
    );
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/map$/);

    const openProperty = async () => {
      const marker = page.locator('.leaflet-marker-icon').first();
      if (await marker.count()) {
        await marker.click();
      } else {
        await page
          .locator('.map-container')
          .click({ position: { x: 200, y: 200 } });
      }
      await expect(
        page.getByRole('region', { name: 'Selected property panel' }),
      ).toBeVisible();
      await expect(page.getByText('Loading property details...')).toHaveCount(
        0,
      );
    };
    const status = (name) =>
      page.getByLabel('Status').selectOption({ label: name });

    // 1. First visit.
    await openProperty();
    await status('Interested');
    await page.getByLabel('Notes').fill('First visit');
    await page.getByRole('button', { name: 'Save interaction' }).click();
    await expect(
      page.getByText('Interaction recorded successfully.'),
    ).toBeVisible();
    await shot(page, '1-first-visit');
    expect(await counts()).toEqual({ snapshots: 1, knocks: 1 });

    // 2. Same-day repeat is held until the rep confirms.
    await openProperty();
    await expect(
      page.getByRole('button', { name: 'Log a visit' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Log a visit' }).click();
    await status('No Answer');
    await page.getByLabel('Notes').fill('Came back after lunch');
    await page.getByRole('button', { name: 'Save interaction' }).click();
    await expect(
      page.getByRole('button', { name: 'Confirm same-day return' }),
    ).toBeVisible();
    await expect(page.getByLabel('Notes')).toHaveValue('Came back after lunch');
    expect(await counts()).toEqual({ snapshots: 1, knocks: 1 });
    await shot(page, '2-same-day-confirm');
    await page.getByRole('button', { name: 'Confirm same-day return' }).click();
    await expect(
      page.getByText('Same-day return recorded. No additional knock'),
    ).toBeVisible();
    const afterReturn = await counts();
    expect(afterReturn.knocks).toBe(1);
    expect(afterReturn.snapshots).toBe(2);

    // 3. A later company-local day earns a new knock.
    await db.query(
      `UPDATE interactions
          SET knock_date = knock_date - 1
        WHERE property_id = $1`,
      [propertyId],
    );
    await openProperty();
    await page.getByRole('button', { name: 'Log a visit' }).click();
    await status('Interested');
    await page.getByLabel('Notes').fill('Next day visit');
    await page.getByRole('button', { name: 'Save interaction' }).click();
    await expect(
      page.getByText('Interaction recorded successfully.'),
    ).toBeVisible();
    await shot(page, '3-later-day');
    const afterLater = await counts();
    expect(afterLater.knocks).toBe(2);

    // 4. Editing the prior visit never earns a knock.
    await openProperty();
    await page
      .getByRole('button', { name: /^Open visit from/ })
      .last()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Interaction Details' }),
    ).toBeVisible();
    await page.locator('.map-detail-edit-button').last().click();
    await page.getByLabel('Notes').fill('Edited prior visit');
    await page.getByRole('button', { name: 'Save interaction' }).click();
    await expect(page.getByText(/saved|updated/i).first()).toBeVisible();
    await shot(page, '4-edit-prior');
    const afterEdit = await counts();
    expect(afterEdit.knocks).toBe(2);
    expect(afterEdit.snapshots).toBe(afterLater.snapshots + 1);
    const { rows: edited } = await db.query(
      `SELECT count(*)::int AS n FROM interactions
        WHERE property_id = $1 AND notes = 'Edited prior visit'`,
      [propertyId],
    );
    expect(edited[0].n).toBeGreaterThan(0);
  } finally {
    await db.end();
  }
});
