import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function loadMigrationEnv() {
  return {
    databaseUrl: must(process.env.DATABASE_URL, 'DATABASE_URL'),
  };
}
