import { query } from 'express-validator';

function isIsoDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

export const getActivityReportValidators = [
  query('dateFrom')
    .exists()
    .withMessage('dateFrom is required.')
    .bail()
    .custom((value) => isIsoDateOnly(value))
    .withMessage('dateFrom must be in YYYY-MM-DD format.'),
  query('dateTo')
    .exists()
    .withMessage('dateTo is required.')
    .bail()
    .custom((value) => isIsoDateOnly(value))
    .withMessage('dateTo must be in YYYY-MM-DD format.'),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('userId must be a valid UUID.'),
  query('teamId')
    .optional()
    .isUUID()
    .withMessage('teamId must be a valid UUID.'),
  query('statusId')
    .optional()
    .isUUID()
    .withMessage('statusId must be a valid UUID.'),
  query().custom((value) => {
    const dateFrom = String(value.dateFrom ?? '');
    const dateTo = String(value.dateTo ?? '');

    if (!isIsoDateOnly(dateFrom) || !isIsoDateOnly(dateTo)) {
      return true;
    }

    // Keep date range coherent before hitting service/repository.
    if (dateFrom > dateTo) {
      throw new Error('dateFrom must be less than or equal to dateTo.');
    }

    return true;
  }),
];
