import { expect, test } from '@playwright/test';
import {
  expectPanelBounds,
  expectReachable,
  installMobileFixture,
  inspectMobilePanel,
} from './mobile-fixture.js';

async function expectUncovered(locator, viewport) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(
    await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return element.contains(hit);
    }),
  ).toBe(true);
}

async function expectNoOverlap(first, second) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(
    a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y,
  ).toBe(false);
}

for (const [width, height] of [
  [360, 640],
  [390, 844],
  [844, 390],
  [360, 330],
  [1280, 800],
]) {
  test(`property fields and save errors remain reachable at ${width}x${height}`, async ({
    page,
  }) => {
    await installMobileFixture(page);
    await inspectMobilePanel(page, { width, height });
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    const zoomOut = page.getByRole('button', { name: 'Zoom out' });
    const recenter = page.getByRole('button', {
      name: 'Recenter to my location',
    });
    const attribution = page.locator('.leaflet-control-attribution a').last();
    for (const control of [zoomIn, zoomOut, recenter, attribution]) {
      await expectUncovered(control, { width, height });
    }
    const panel = page.getByRole('region', { name: 'Selected property panel' });
    for (const control of [zoomIn, zoomOut, recenter, attribution]) {
      await expectNoOverlap(control, panel);
    }
    await expectNoOverlap(zoomOut, attribution);
    await zoomIn.click();
    await expect(recenter).toBeEnabled();
    await expectUncovered(recenter, { width, height });
    await recenter.click();
    await expect(recenter).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Selected property panel' }),
    ).toHaveCount(0);
    await page.locator('.leaflet-marker-icon').first().click();
    await expect(page.getByLabel('Notes')).toHaveValue(
      'Draft after failed save',
    );
  });

  test(`same-day confirmation and draft remain reachable at ${width}x${height}`, async ({
    page,
  }) => {
    const requests = await installMobileFixture(page, { scenario: 'same-day' });
    await page.setViewportSize({ width, height });
    await page.goto('/map');
    await page.locator('.leaflet-marker-icon').first().click();
    const panel = page.getByRole('region', { name: 'Selected property panel' });
    await expectPanelBounds(page, { width, height });
    await page.getByLabel('Status').selectOption('mobile-status');
    await page.getByLabel('Notes').fill('Return draft');
    const draft = page.getByRole('button', { name: 'Save draft' });
    await expectReachable(draft, panel, { width, height });
    await draft.click();
    const save = page.getByRole('button', { name: 'Save interaction' });
    await expectReachable(save, panel, { width, height });
    await save.click();
    const confirmation = page.getByRole('button', {
      name: 'Confirm same-day return',
    });
    await expectPanelBounds(page, { width, height });
    await expectReachable(confirmation, panel, { width, height });
    await expect(page.getByLabel('Notes')).toHaveValue('Return draft');
    await confirmation.click();
    await expect(
      page.getByText(
        'Same-day return recorded. No additional knock was added.',
      ),
    ).toBeVisible();
    await expectPanelBounds(page, { width, height });
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({
      sameDayReturn: true,
      notes: 'Return draft',
    });
  });

  test(`edit and save failure remain reachable at ${width}x${height}`, async ({
    page,
  }) => {
    const requests = await installMobileFixture(page, { scenario: 'edit' });
    await page.setViewportSize({ width, height });
    await page.goto('/map');
    await page.locator('.leaflet-marker-icon').first().click();
    const panel = page.getByRole('region', { name: 'Selected property panel' });
    await expect(
      page.getByRole('heading', { name: 'Interaction Details' }),
    ).toBeVisible();
    await expectPanelBounds(page, { width, height });
    const edit = panel.locator('.map-detail-edit-button').last();
    await expectReachable(edit, panel, { width, height });
    await edit.click();
    const notes = page.getByLabel('Notes');
    await expectReachable(notes, panel, { width, height });
    await notes.fill('Edit draft');
    const save = page.getByRole('button', { name: 'Save interaction' });
    await expectReachable(save, panel, { width, height });
    await save.click();
    const error = panel.getByText(
      /The server could not complete this save right now/,
    );
    await expectReachable(error, panel, { width, height });
    await expectPanelBounds(page, { width, height });
    await expect(notes).toHaveValue('Edit draft');
    expect(requests).toHaveLength(1);
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
    await expectReachable(cancel, panel, { width, height });
    await cancel.click();
    await expect(panel).toHaveCount(0);
  });
}

test('panel uses the map container bounds on a wider viewport', async ({
  page,
}) => {
  await installMobileFixture(page);
  const viewport = { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  await page.goto('/map');
  await page.locator('.map-stage').evaluate((stage) => {
    stage.style.width = '600px';
    stage.style.height = '400px';
    stage.style.marginInline = 'auto';
  });
  await page.locator('.leaflet-marker-icon').first().click();
  const panel = await expectPanelBounds(page, viewport);
  const box = await panel.boundingBox();
  expect(box.width).toBeLessThanOrEqual(600);
});
