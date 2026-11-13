import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
});
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL is required for the full/integration suite. Use test:unit for database-free checks.',
  );
}
process.env.NODE_ENV = 'test';
const { assertSafeTestDatabaseUrl } = await import('../src/db/client.js');
assertSafeTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
);
