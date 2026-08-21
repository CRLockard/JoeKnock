import { Router } from 'express';
import { validate } from '../validation/validate.js';
import { createInteractionsService } from './interactionsService.js';
import {
  getInteractionValidators,
  updateInteractionValidators,
} from './interactionsValidation.js';

export function buildInteractionsRoutes({
  interactionsService = createInteractionsService(),
} = {}) {
  const router = Router();

  router.get(
    '/:id',
    getInteractionValidators,
    validate,
    async (req, res, next) => {
      try {
        const snapshot = await interactionsService.getInteractionSnapshotById({
          organizationId: req.auth.organizationId,
          userId: req.auth.userId,
          role: req.auth.role,
          interactionId: req.params.id,
        });

        return res.status(200).json(snapshot);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    '/:id',
    // POST is used intentionally for revision action semantics in MVP while
    // service enforces immutable snapshot creation instead of in-place update.
    updateInteractionValidators,
    validate,
    async (req, res, next) => {
      try {
        const revised = await interactionsService.reviseInteraction({
          organizationId: req.auth.organizationId,
          userId: req.auth.userId,
          role: req.auth.role,
          interactionId: req.params.id,
          statusId: req.body.statusId,
          contactName: req.body.contactName,
          contactPhone: req.body.contactPhone,
          contactEmail: req.body.contactEmail,
          notes: req.body.notes,
        });

        return res.status(200).json(revised);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
