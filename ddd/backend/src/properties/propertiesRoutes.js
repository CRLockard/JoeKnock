import { Router } from 'express';
import { createPropertiesService } from './propertiesService.js';
import {
  getPropertyInteractionsValidators,
  getPropertyValidators,
  resolvePropertyValidators,
} from './propertiesValidation.js';
import { validate } from '../validation/validate.js';
import { createInteractionsService } from '../interactions/interactionsService.js';
import { createInteractionValidators } from '../interactions/interactionsValidation.js';

export function buildPropertiesRoutes({
  propertiesService = createPropertiesService(),
  interactionsService = createInteractionsService(),
} = {}) {
  const router = Router();

  router.post(
    '/:propertyId/interactions',
    createInteractionValidators,
    validate,
    async (req, res, next) => {
      try {
        const snapshot = await interactionsService.createInteractionForProperty(
          {
            organizationId: req.auth.organizationId,
            userId: req.auth.userId,
            propertyId: req.params.propertyId,
            statusId: req.body.statusId,
            contactName: req.body.contactName,
            contactPhone: req.body.contactPhone,
            contactEmail: req.body.contactEmail,
            notes: req.body.notes,
            clientRequestId: req.body.clientRequestId,
          },
        );

        return res.status(201).json(snapshot);
      } catch (error) {
        return next(error);
      }
    },
  );

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
