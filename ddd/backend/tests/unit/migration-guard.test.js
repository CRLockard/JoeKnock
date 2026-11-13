import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { runMigration } from '../../scripts/migrate.js';
import { loadMigrationEnv } from '../../src/config/migrationEnv.js';

const developmentDatabaseUrl = 'postgres://localhost/joeknock_dev';
const testDatabaseUrl = 'postgres://localhost/joeknock_test';

describe('migration database guard', () => {
  it('rejects a development migration target in test mode before spawning', () => {
    const spawnProcess = vi.fn();

    expect(() =>
      runMigration({
        args: ['up'],
        environment: {
          NODE_ENV: 'test',
          DATABASE_URL: developmentDatabaseUrl,
          TEST_DATABASE_URL: testDatabaseUrl,
        },
        spawnProcess,
      }),
    ).toThrow('DATABASE_URL must match TEST_DATABASE_URL for test migrations.');

    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it('rejects a test setting that names the development database before spawning', () => {
    const spawnProcess = vi.fn();

    expect(() =>
      runMigration({
        args: ['up'],
        environment: {
          NODE_ENV: 'test',
          DATABASE_URL: developmentDatabaseUrl,
          TEST_DATABASE_URL: developmentDatabaseUrl,
        },
        spawnProcess,
      }),
    ).toThrow('test-only');

    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it('passes a validated disposable URL to the migration process in test mode', () => {
    const child = new EventEmitter();
    const spawnProcess = vi.fn(() => child);

    const result = runMigration({
      args: ['up'],
      environment: {
        NODE_ENV: 'test',
        DATABASE_URL: testDatabaseUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
        DEVELOPMENT_DATABASE_URL: developmentDatabaseUrl,
      },
      spawnProcess,
      platform: 'linux',
    });

    expect(result).toBe(child);
    expect(spawnProcess).toHaveBeenCalledOnce();
    expect(spawnProcess.mock.calls[0][2].env.DATABASE_URL).toBe(
      testDatabaseUrl,
    );
  });

  it('continues to use DATABASE_URL for intentional development migrations', () => {
    expect(
      loadMigrationEnv({
        NODE_ENV: 'development',
        DATABASE_URL: developmentDatabaseUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
      }),
    ).toEqual({ databaseUrl: developmentDatabaseUrl });
  });
});
