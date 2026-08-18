import { Router } from 'express';
import { AppError } from '../common/errors.js';
import { validate } from '../validation/validate.js';
import { createStatusesService } from './statusesService.js';
import {
  createStatusValidators,
  updateStatusActiveValidators,
  updateStatusValidators,
} from './statusesValidation.js';

function requireRoles(allowedRoles) {
  const allowedRoleSet = new Set(allowedRoles);

  return (req, res, next) => {
    void res;

    if (!allowedRoleSet.has(req.auth.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          'You do not have permission to perform this action.',
        ),
      );
    }

    return next();
  };
}

export function buildStatusesRoutes({
  statusesService = createStatusesService(),
} = {}) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const statuses = await statusesService.listActiveStatuses({
        organizationId: req.auth.organizationId,
      });

      return res.status(200).json(statuses);
    } catch (error) {
      return next(error);
    }
  });

  router.post(
    '/',
    requireRoles(['manager', 'admin']),
    createStatusValidators,
    validate,
    async (req, res, next) => {
      try {
        const status = await statusesService.createStatus({
          organizationId: req.auth.organizationId,
          name: req.body.name,
          description: req.body.description,
          displayOrder: req.body.displayOrder,
        });

        return res.status(201).json(status);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.patch(
    '/:id',
    requireRoles(['manager', 'admin']),
    updateStatusValidators,
    validate,
    async (req, res, next) => {
      try {
        const status = await statusesService.updateStatus({
          organizationId: req.auth.organizationId,
          statusId: req.params.id,
          name: req.body.name,
          description: req.body.description,
          displayOrder: req.body.displayOrder,
        });

        return res.status(200).json(status);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.patch(
    '/:id/active',
    requireRoles(['manager', 'admin']),
    updateStatusActiveValidators,
    validate,
    async (req, res, next) => {
      try {
        const status = await statusesService.setStatusActive({
          organizationId: req.auth.organizationId,
          statusId: req.params.id,
          isActive: req.body.isActive,
        });

        return res.status(200).json(status);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
