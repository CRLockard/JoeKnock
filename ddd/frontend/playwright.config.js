import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Ports can be overridden so a full-stack run never collides with dev servers.
const apiPort = process.env.JOEKNOCK_E2E_API_PORT || '3000';
const webPort = process.env.JOEKNOCK_E2E_WEB_PORT || '4173';
const fullStack = process.env.JOEKNOCK_FULL_STACK === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'on-first-retry',
  },
  webServer: [
    ...(fullStack
      ? [
          {
            command:
              'node scripts/require-test-database.js && node src/server.js',
            cwd: fileURLToPath(new URL('../backend/', import.meta.url)),
            port: Number(apiPort),
            env: {
              NODE_ENV: 'test',
              PORT: apiPort,
              CORS_ORIGIN: `http://127.0.0.1:${webPort}`,
            },
            reuseExistingServer: false,
          },
        ]
      : []),
    {
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${webPort}`,
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      port: Number(webPort),
      reuseExistingServer: !process.env.CI && !fullStack,
      timeout: 120_000,
      env: {
        NODE_ENV: 'production',
        ...(fullStack
          ? { VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}/api` }
          : {}),
      },
    },
  ],
});
