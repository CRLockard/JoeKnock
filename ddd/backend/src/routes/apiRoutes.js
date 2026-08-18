import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../validation/validate.js';
import { buildAuthRoutes } from '../auth/authRoutes.js';
import { createAuthService } from '../auth/authService.js';
import { buildOrganizationRoutes } from '../organization/organizationRoutes.js';
import { createOrganizationService } from '../organization/organizationService.js';
import { buildTeamsRoutes } from '../teams/teamsRoutes.js';
import { createTeamsService } from '../teams/teamsService.js';
import { buildUsersRoutes } from '../users/usersRoutes.js';
import { createUsersService } from '../users/usersService.js';
import { buildStatusesRoutes } from '../statuses/statusesRoutes.js';
import { createStatusesService } from '../statuses/statusesService.js';
import { buildMapRoutes } from '../map/mapRoutes.js';
import { createMapService } from '../map/mapService.js';

export function buildApiRoutes({
  authService,
  organizationService,
  teamsService,
  usersService,
  statusesService,
  mapService,
} = {}) {
  const router = Router();
  const resolvedAuthService = authService ?? createAuthService();
  const resolvedOrganizationService =
    organizationService ?? createOrganizationService();
  const resolvedTeamsService = teamsService ?? createTeamsService();
  const resolvedUsersService = usersService ?? createUsersService();
  const resolvedStatusesService = statusesService ?? createStatusesService();
  const resolvedMapService = mapService ?? createMapService();

  router.use('/auth', buildAuthRoutes({ authService: resolvedAuthService }));
  router.use(
    '/organization',
    authMiddleware,
    buildOrganizationRoutes({
      organizationService: resolvedOrganizationService,
    }),
  );
  router.use(
    '/users',
    authMiddleware,
    buildUsersRoutes({
      usersService: resolvedUsersService,
    }),
  );
  router.use(
    '/teams',
    authMiddleware,
    buildTeamsRoutes({
      teamsService: resolvedTeamsService,
    }),
  );
  router.use(
    '/statuses',
    authMiddleware,
    buildStatusesRoutes({
      statusesService: resolvedStatusesService,
    }),
  );
  router.use(
    '/map',
    authMiddleware,
    buildMapRoutes({
      mapService: resolvedMapService,
    }),
  );

  router.get('/me', authMiddleware, async (req, res, next) => {
    try {
      // Identity is derived from validated JWT claims, never from request input.
      const user = await resolvedAuthService.getCurrentUser({
        userId: req.auth.userId,
        organizationId: req.auth.organizationId,
      });

      return res.status(200).json(user);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/_scaffold/protected', authMiddleware, (req, res) => {
    return res.status(200).json({
      ok: true,
      auth: req.auth,
    });
  });

  router.post(
    '/_scaffold/validate',
    body('value').isString().notEmpty(),
    validate,
    (req, res) => {
      return res.status(200).json({
        value: req.body.value,
      });
    },
  );

  return router;
}
