import { Router } from 'express';
import { AppError } from '../common/errors.js';
import { createTeamsService } from './teamsService.js';
import { createTeamValidators, getTeamValidators } from './teamsValidation.js';
import { validate } from '../validation/validate.js';

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

export function buildTeamsRoutes({ teamsService = createTeamsService() } = {}) {
  const router = Router();

  router.get(
    '/',
    requireRoles(['manager', 'admin']),
    async (req, res, next) => {
      try {
        const teams = await teamsService.listTeams({
          organizationId: req.auth.organizationId,
        });

        return res.status(200).json(teams);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get(
    '/:id',
    requireRoles(['manager', 'admin']),
    getTeamValidators,
    validate,
    async (req, res, next) => {
      try {
        const team = await teamsService.getTeam({
          teamId: req.params.id,
          organizationId: req.auth.organizationId,
        });

        return res.status(200).json(team);
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    '/',
    requireRoles(['manager', 'admin']),
    createTeamValidators,
    validate,
    async (req, res, next) => {
      try {
        const team = await teamsService.createTeam({
          organizationId: req.auth.organizationId,
          name: req.body.name,
        });

        return res.status(201).json(team);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
