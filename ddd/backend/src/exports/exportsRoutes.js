import { Router } from 'express';
import { AppError } from '../common/errors.js';
import { validate } from '../validation/validate.js';
import { getActivityReportValidators } from '../reports/reportsValidation.js';
import { createExportsService } from './exportsService.js';

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

export function buildExportsRoutes({
  exportsService = createExportsService(),
} = {}) {
  const router = Router();

  router.get(
    '/properties',
    // Export uses same permission boundary as reports because it serializes
    // the same activity domain into a downloadable artifact.
    requireRoles(['manager', 'admin']),
    getActivityReportValidators,
    validate,
    async (req, res, next) => {
      try {
        const result = await exportsService.exportPropertiesCsv({
          organizationId: req.auth.organizationId,
          actorUserId: req.auth.userId,
          actorRole: req.auth.role,
          dateFrom: req.query.dateFrom,
          dateTo: req.query.dateTo,
          userId: req.query.userId,
          teamId: req.query.teamId,
          statusId: req.query.statusId,
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${result.filename}"`,
        );

        return res.status(200).send(result.csv);
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
