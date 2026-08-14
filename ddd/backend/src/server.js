import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './db/client.js';
import { logger } from './common/logger.js';

const app = createApp();
const server = createServer(app);

server.listen(env.port, () => {
  logger.info('Backend listening', {
    port: env.port,
    env: env.nodeEnv,
  });
});

async function shutdown(signal) {
  logger.info('Shutdown signal received', { signal });

  const timeout = setTimeout(() => {
    logger.error('Forced shutdown timeout reached');
    process.exit(1);
  }, 10_000);

  server.close(async () => {
    try {
      await closePool();
      clearTimeout(timeout);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      clearTimeout(timeout);
      logger.error('Failed to close resources', {
        error: error?.message,
      });
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
