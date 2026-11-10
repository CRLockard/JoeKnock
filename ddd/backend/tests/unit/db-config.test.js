import { describe, expect, it } from 'vitest';
import {
  resolveDatabaseUrlForMode,
  assertSafeTestDatabaseUrl,
} from '../../src/db/client.js';

describe('database config isolation', () => {
  it('rejects shared targets even if URL spelling or credentials differ', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://test:pw@127.0.0.1:5432/shared_test?sslmode=disable',
        'postgres://dev:pw@localhost/shared_test',
      ),
    ).toThrow('same database');
  });
  it('rejects a non-test target instead of trusting string inequality', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgres://localhost/production'),
    ).toThrow('test-only');
  });
  it('uses TEST_DATABASE_URL in test mode', () => {
    const value = resolveDatabaseUrlForMode({
      isTest: true,
      databaseUrl: 'postgres://dev-db.example/app',
      testDatabaseUrl: 'postgres://test-db.example/app_test',
    });

    expect(value).toBe('postgres://test-db.example/app_test');
  });

  it('rejects missing TEST_DATABASE_URL in test mode', () => {
    expect(() =>
      resolveDatabaseUrlForMode({
        isTest: true,
        databaseUrl: 'postgres://dev-db.example/app',
        testDatabaseUrl: '',
      }),
    ).toThrow('Missing required environment variable: TEST_DATABASE_URL');
  });

  it('rejects test mode when TEST_DATABASE_URL matches DATABASE_URL', () => {
    expect(() =>
      resolveDatabaseUrlForMode({
        isTest: true,
        databaseUrl: 'postgres://same-db.example/app',
        testDatabaseUrl: 'postgres://same-db.example/app',
      }),
    ).toThrow('TEST_DATABASE_URL must not match DATABASE_URL in test mode.');
  });

  it('uses DATABASE_URL outside test mode', () => {
    const value = resolveDatabaseUrlForMode({
      isTest: false,
      databaseUrl: 'postgres://dev-db.example/app',
      testDatabaseUrl: 'postgres://test-db.example/app_test',
    });

    expect(value).toBe('postgres://dev-db.example/app');
  });
});
