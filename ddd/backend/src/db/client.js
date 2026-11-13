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

    assertSafeTestDatabaseUrl(testUrl, config.databaseUrl);

    return testUrl;
  }

  return must(config.databaseUrl, 'DATABASE_URL');
}

export function assertSafeTestDatabaseUrl(testUrl, developmentUrl) {
  let target;
  try {
    target = new URL(testUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !/(^|[_-])test($|[_-])/i.test(decodeURIComponent(target.pathname.slice(1)))
  ) {
    throw new Error(
      'TEST_DATABASE_URL must name an explicitly test-only database (for example joeknock_test).',
    );
  }
  if (developmentUrl) {
    const development = new URL(developmentUrl);
    const host = (url) =>
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname.toLowerCase())
        ? 'loopback'
        : url.hostname.toLowerCase();
    if (
      host(target) === host(development) &&
      (target.port || '5432') === (development.port || '5432') &&
      decodeURIComponent(target.pathname) ===
        decodeURIComponent(development.pathname)
    ) {
      throw new Error(
        'TEST_DATABASE_URL must not target the same database as DATABASE_URL.',
      );
    }
  }
  return decodeURIComponent(target.pathname.slice(1));
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
