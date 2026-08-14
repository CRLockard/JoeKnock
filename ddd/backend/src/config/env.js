import dotenv from 'dotenv';

dotenv.config();

function must(value, key) {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function intFrom(value, key) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer`);
  }

  return parsed;
}

export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isTest = nodeEnv === 'test' || process.env.VITEST === 'true';

  const env = {
    isTest,
    nodeEnv,
    port: intFrom(process.env.PORT ?? (isTest ? '0' : '3000'), 'PORT'),
    databaseUrl: process.env.DATABASE_URL,
    testDatabaseUrl: process.env.TEST_DATABASE_URL,
    jwtSecret:
      process.env.JWT_SECRET ?? (isTest ? 'test-only-secret' : undefined),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? (isTest ? '15m' : undefined),
    corsOrigin:
      process.env.CORS_ORIGIN ?? (isTest ? 'http://localhost:5173' : undefined),
    logLevel: process.env.LOG_LEVEL ?? (isTest ? 'silent' : undefined),
  };

  if (!isTest) {
    must(env.databaseUrl, 'DATABASE_URL');
    must(env.jwtSecret, 'JWT_SECRET');
    must(env.jwtExpiresIn, 'JWT_EXPIRES_IN');
    must(env.corsOrigin, 'CORS_ORIGIN');
    must(env.logLevel, 'LOG_LEVEL');
  }

  return env;
}

export const env = loadEnv();
