import { Router } from 'express';
import { createPropertiesService } from './propertiesService.js';
import {
  getPropertyInteractionsValidators,
  getPropertyValidators,
  resolvePropertyValidators,
} from './propertiesValidation.js';
import { validate } from '../validation/validate.js';

export function buildPropertiesRoutes({
  propertiesService = createPropertiesService(),
} = {}) {
  const router = Router();

  router.get(
    '/:id',
    getPropertyValidators,
    validate,
    async (req, res, next) => {
      try {
        const property = await propertiesService.getPropertyById({
          organizationId: req.auth.organizationId,
          propertyId: req.params.id,
        });

        return res.status(200).json(property);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get(
    '/:propertyId/interactions',
    getPropertyInteractionsValidators,
    validate,
    async (req, res, next) => {
      try {
        const payload = await propertiesService.listCurrentPropertyInteractions(
          {
            organizationId: req.auth.organizationId,
            userId: req.auth.userId,
            role: req.auth.role,
            propertyId: req.params.propertyId,
          },
        );

        return res.status(200).json(payload);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    '/resolve',
    resolvePropertyValidators,
    validate,
    async (req, res, next) => {
      try {
        const resolved = await propertiesService.resolveProperty({
          organizationId: req.auth.organizationId,
          latitude: Number(req.body.latitude),
          longitude: Number(req.body.longitude),
          requestId: req.requestId,
        });

        return res.status(200).json(resolved);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
