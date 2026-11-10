import { test } from '@playwright/test';
import { installMobileFixture, inspectMobilePanel } from './mobile-fixture.js';

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
  });
}
