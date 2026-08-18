import { body, param } from 'express-validator';

const MUTABLE_STATUS_FIELDS = ['name', 'description', 'displayOrder'];
const ACTIVE_MUTABLE_FIELDS = ['isActive'];

export const createStatusValidators = [
  body('name').isString().trim().notEmpty().isLength({ max: 100 }),
  body('description')
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === 'string'),
  body('displayOrder').isInt({ min: 1 }),
];

export const updateStatusValidators = [
  param('id').isUUID(),
  body().custom((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Request body must be an object.');
    }

    const providedFields = Object.keys(value);

    if (providedFields.length === 0) {
      throw new Error('At least one updatable field is required.');
    }

    const disallowedFields = providedFields.filter(
      (field) => !MUTABLE_STATUS_FIELDS.includes(field),
    );

    if (disallowedFields.length > 0) {
      throw new Error(
        `Unsupported fields for status update: ${disallowedFields.join(', ')}.`,
      );
    }

    return true;
  }),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  body('description')
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === 'string'),
  body('displayOrder').optional().isInt({ min: 1 }),
];

export const updateStatusActiveValidators = [
  param('id').isUUID(),
  body().custom((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Request body must be an object.');
    }

    const providedFields = Object.keys(value);

    if (providedFields.length === 0) {
      throw new Error('isActive is required.');
    }

    const disallowedFields = providedFields.filter(
      (field) => !ACTIVE_MUTABLE_FIELDS.includes(field),
    );

    if (disallowedFields.length > 0) {
      throw new Error(
        `Unsupported fields for status active update: ${disallowedFields.join(', ')}.`,
      );
    }

    return true;
  }),
  body('isActive').exists().isBoolean(),
];
