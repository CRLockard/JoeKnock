import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMigrationEnv } from '../src/config/migrationEnv.js';

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

export function runMigration({
  args = process.argv.slice(2),
  environment = process.env,
  spawnProcess = spawn,
  platform = process.platform,
  onExit = (code) => process.exit(code ?? 1),
} = {}) {
  const migrationEnv = loadMigrationEnv(environment);
  const [command = 'up', ...extraArgs] = args;
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
      ...environment,
      DATABASE_URL: migrationEnv.databaseUrl,
    },
  };

  const child =
    platform === 'win32'
      ? spawnProcess('cmd.exe', ['/c', migrateBin, ...baseArgs], spawnOptions)
      : spawnProcess(migrateBin, baseArgs, spawnOptions);

  child.on('exit', onExit);
  return child;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    runMigration();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
