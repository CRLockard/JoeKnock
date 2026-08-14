import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repositoryEnvPath = path.resolve(currentDirPath, '../../.env');

dotenv.config({ path: repositoryEnvPath });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
