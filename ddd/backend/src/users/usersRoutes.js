import { Router } from 'express';
import { AppError } from '../common/errors.js';
import { createUsersService } from './usersService.js';
import { createUserValidators } from './usersValidation.js';
import { validate } from '../validation/validate.js';

function requireRoles(allowedRoles) {
  const allowedRoleSet = new Set(allowedRoles);

  return (req, res, next) => {
    void res;

    // Authorization decisions are bound to validated JWT claims so clients
    // cannot escalate privileges via request payload tampering.
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

export function buildUsersRoutes({ usersService = createUsersService() } = {}) {
  const router = Router();

  router.post(
    '/',
    requireRoles(['manager', 'admin']),
    createUserValidators,
    validate,
    async (req, res, next) => {
      try {
        // Organization ownership always comes from auth context, never client input.
        const user = await usersService.createUser({
          organizationId: req.auth.organizationId,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          password: req.body.password,
          role: req.body.role,
        });

        return res.status(201).json(user);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
