import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { query } from './db/client.js';
import { logger } from './common/logger.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import {
  notFoundMiddleware,
  errorMiddleware,
} from './middleware/errorMiddleware.js';
import { buildHealthRoutes } from './routes/healthRoutes.js';
import { buildApiRoutes } from './routes/apiRoutes.js';

function parseCorsOrigins(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createApp({
  db = { query },
  authService,
  organizationService,
  usersService,
  statusesService,
  mapService,
  propertiesService,
  interactionsService,
  reportsService,
} = {}) {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(
    cors({
      origin: parseCorsOrigins(env.corsOrigin),
    }),
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 250,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json());

  app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      logger.info('request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });

  app.use(buildHealthRoutes({ db }));
  app.use(
    '/api',
    buildApiRoutes({
      authService,
      organizationService,
      usersService,
      statusesService,
      mapService,
      propertiesService,
      interactionsService,
      reportsService,
    }),
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
