import { Router } from 'express';
import { validate } from '../validation/validate.js';
import { createMapService } from './mapService.js';
import { mapPropertiesQueryValidators } from './mapValidation.js';

export function buildMapRoutes({ mapService = createMapService() } = {}) {
  const router = Router();

  router.get(
    '/properties',
    mapPropertiesQueryValidators,
    validate,
    async (req, res, next) => {
      try {
        const markers = await mapService.listVisiblePropertyMarkers({
          organizationId: req.auth.organizationId,
          userId: req.auth.userId,
          role: req.auth.role,
          north: Number(req.query.north),
          south: Number(req.query.south),
          east: Number(req.query.east),
          west: Number(req.query.west),
        });

        return res.status(200).json(markers);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
