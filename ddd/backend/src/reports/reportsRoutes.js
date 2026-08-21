import { Router } from 'express';
import { AppError } from '../common/errors.js';
import { validate } from '../validation/validate.js';
import { createReportsService } from './reportsService.js';
import { getActivityReportValidators } from './reportsValidation.js';

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

export function buildReportsRoutes({
  reportsService = createReportsService(),
} = {}) {
  const router = Router();

  router.get(
    '/activity',
    // Reports are restricted because they aggregate cross-user activity.
    requireRoles(['manager', 'admin']),
    getActivityReportValidators,
    validate,
    async (req, res, next) => {
      try {
        const report = await reportsService.getActivityReport({
          organizationId: req.auth.organizationId,
          actorUserId: req.auth.userId,
          actorRole: req.auth.role,
          dateFrom: req.query.dateFrom,
          dateTo: req.query.dateTo,
          userId: req.query.userId,
          teamId: req.query.teamId,
          statusId: req.query.statusId,
        });

        return res.status(200).json(report);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
