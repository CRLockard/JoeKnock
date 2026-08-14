import { env } from '../config/env.js';

const levelWeights = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level) {
  return levelWeights[level] <= levelWeights[env.logLevel ?? 'info'];
}

function base(level, message, meta = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  console.log(JSON.stringify(payload));
}

export const logger = {
  error(message, meta) {
    base('error', message, meta);
  },
  warn(message, meta) {
    base('warn', message, meta);
  },
  info(message, meta) {
    base('info', message, meta);
  },
  debug(message, meta) {
    base('debug', message, meta);
  },
};
