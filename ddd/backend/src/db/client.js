import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

let pool;

function must(value, key) {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function resolveDatabaseUrlForMode(config = env) {
  if (config.isTest) {
    // Hard guard to reduce risk of destructive test runs against dev/prod DB.
    const testUrl = must(config.testDatabaseUrl, 'TEST_DATABASE_URL');

    if (config.databaseUrl && config.databaseUrl === testUrl) {
      throw new Error(
        'TEST_DATABASE_URL must not match DATABASE_URL in test mode.',
      );
    }

    return testUrl;
  }

  return must(config.databaseUrl, 'DATABASE_URL');
}

export function getPool() {
  if (!pool) {
    // Singleton pool keeps connection management centralized for the process.
    pool = new Pool({ connectionString: resolveDatabaseUrlForMode() });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
