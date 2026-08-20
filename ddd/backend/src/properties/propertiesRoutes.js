import { Router } from 'express';
import { createPropertiesService } from './propertiesService.js';
import { resolvePropertyValidators } from './propertiesValidation.js';
import { validate } from '../validation/validate.js';

export function buildPropertiesRoutes({
  propertiesService = createPropertiesService(),
} = {}) {
  const router = Router();

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
