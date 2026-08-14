import { Router } from 'express';
import { createAuthService } from './authService.js';
import { registerValidators } from './authValidation.js';
import { validate } from '../validation/validate.js';

export function buildAuthRoutes({ authService = createAuthService() } = {}) {
  const router = Router();

  router.post(
    '/register',
    registerValidators,
    validate,
    async (req, res, next) => {
      try {
        const result = await authService.registerOrganization({
          organizationName: req.body.organizationName,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          password: req.body.password,
          timezone: req.body.timezone,
        });

        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
