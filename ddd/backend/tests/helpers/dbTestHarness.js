import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../../src/db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');

let migrationPromise;

export function hasTestDatabase() {
  return Boolean(process.env.TEST_DATABASE_URL);
}

function runMigrationCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/migrate.js', ...args], {
      cwd: backendRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: process.env.TEST_DATABASE_URL,
      },
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Migration command failed with exit code ${code}`));
    });

    child.on('error', reject);
  });
}

export async function ensureTestMigrations() {
  if (!hasTestDatabase()) {
    throw new Error('TEST_DATABASE_URL is required for database-backed tests.');
  }

  if (!migrationPromise) {
    migrationPromise = runMigrationCommand(['up']);
  }

  await migrationPromise;
}

export async function resetRegistrationTables() {
  await query('DELETE FROM team_users');
  await query('DELETE FROM interactions');
  await query('DELETE FROM statuses');
  await query('DELETE FROM properties');
  await query('DELETE FROM teams');
  await query('DELETE FROM users');
  await query('DELETE FROM organization_settings');
  await query('DELETE FROM organizations');
}
