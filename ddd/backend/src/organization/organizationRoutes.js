import { Router } from 'express';
import { AppError } from '../common/errors.js';
import { createOrganizationService } from './organizationService.js';
import {
  updateOrganizationSettingsValidators,
  updateOrganizationValidators,
} from './organizationValidation.js';
import { validate } from '../validation/validate.js';

function requireRoles(allowedRoles) {
  const allowedRoleSet = new Set(allowedRoles);

  return (req, res, next) => {
    void res;

    // Role checks must use validated JWT claims, never client input.
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

export function buildOrganizationRoutes({
  organizationService = createOrganizationService(),
} = {}) {
  const router = Router();

  router.get(
    '/settings',
    requireRoles(['manager', 'admin']),
    async (req, res, next) => {
      try {
        const settings = await organizationService.getOrganizationSettings({
          organizationId: req.auth.organizationId,
        });

        return res.status(200).json(settings);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.patch(
    '/settings',
    requireRoles(['admin']),
    updateOrganizationSettingsValidators,
    validate,
    async (req, res, next) => {
      try {
        const settings = await organizationService.updateOrganizationSettings({
          organizationId: req.auth.organizationId,
          repVisibility: req.body.rep_visibility,
          timezone: req.body.timezone,
        });

        return res.status(200).json(settings);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get(
    '/',
    requireRoles(['manager', 'admin']),
    async (req, res, next) => {
      try {
        const organization = await organizationService.getOrganization({
          organizationId: req.auth.organizationId,
        });

        return res.status(200).json(organization);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.patch(
    '/',
    requireRoles(['admin']),
    updateOrganizationValidators,
    validate,
    async (req, res, next) => {
      try {
        const organization = await organizationService.updateOrganization({
          organizationId: req.auth.organizationId,
          name: req.body.name,
        });

        return res.status(200).json(organization);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
