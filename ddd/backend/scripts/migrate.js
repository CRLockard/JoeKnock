import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMigrationEnv } from '../src/config/migrationEnv.js';

const migrationEnv = loadMigrationEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const migrateBin = path.resolve(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'node-pg-migrate.cmd' : 'node-pg-migrate',
);
const migrationsDir = path.resolve(projectRoot, 'migrations');

const command = process.argv[2] ?? 'up';
const extraArgs = process.argv.slice(3);

const baseArgs = [
  command,
  ...extraArgs,
  '-m',
  migrationsDir,
  '-d',
  'DATABASE_URL',
];
const spawnOptions = {
  stdio: 'inherit',
  cwd: projectRoot,
  shell: false,
  env: {
    ...process.env,
    DATABASE_URL: migrationEnv.databaseUrl,
  },
};

const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', migrateBin, ...baseArgs], spawnOptions)
    : spawn(migrateBin, baseArgs, spawnOptions);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
