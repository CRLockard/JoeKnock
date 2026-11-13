import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeTestDatabaseUrl } from '../db/testDatabaseUrl.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repositoryRootPath = path.resolve(currentDirPath, '../../../../');
const repositoryEnvPath = path.resolve(repositoryRootPath, '.env');

dotenv.config({ path: repositoryEnvPath });

function must(value, key) {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function loadMigrationEnv(environment = process.env) {
  const isTest =
    environment.NODE_ENV === 'test' || environment.VITEST === 'true';

  if (isTest) {
    const testDatabaseUrl = must(
      environment.TEST_DATABASE_URL,
      'TEST_DATABASE_URL',
    );
    const developmentDatabaseUrl =
      environment.DEVELOPMENT_DATABASE_URL ??
      (environment.DATABASE_URL !== testDatabaseUrl
        ? environment.DATABASE_URL
        : undefined);

    assertSafeTestDatabaseUrl(testDatabaseUrl, developmentDatabaseUrl);

    if (environment.DATABASE_URL !== testDatabaseUrl) {
      throw new Error(
        'DATABASE_URL must match TEST_DATABASE_URL for test migrations.',
      );
    }

    return { databaseUrl: testDatabaseUrl };
  }

  return {
    databaseUrl: must(environment.DATABASE_URL, 'DATABASE_URL'),
  };
}
