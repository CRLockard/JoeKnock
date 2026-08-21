import { body, param, query } from 'express-validator';

const USER_ROLES = ['admin', 'manager', 'rep'];
const MUTABLE_USER_FIELDS = ['firstName', 'lastName', 'role'];
const USER_ACTIVE_MUTABLE_FIELDS = ['isActive'];

export const createUserValidators = [
  body('firstName').isString().trim().notEmpty().isLength({ max: 100 }),
  body('lastName').isString().trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('role').isString().trim().isIn(USER_ROLES),
];

export const listUsersValidators = [
  query('active')
    .optional()
    .isString()
    .isIn(['true', 'false'])
    .withMessage('active must be either true or false.'),
  query('role').optional().isString().trim().isIn(USER_ROLES),
  query('teamId')
    .optional()
    .custom(() => {
      // Explicitly blocked to match current MVP scope and prevent false assumptions.
      throw new Error(
        'teamId filtering is not available until team foundation tickets are implemented.',
      );
    }),
];

export const updateUserValidators = [
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
      (field) => !MUTABLE_USER_FIELDS.includes(field),
    );

    // Enforce strict payload shape for deterministic partial updates.
    if (disallowedFields.length > 0) {
      throw new Error(
        `Unsupported fields for user update: ${disallowedFields.join(', ')}.`,
      );
    }

    return true;
  }),
  body('firstName')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 100 }),
  body('lastName')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 100 }),
  body('role').optional().isString().trim().isIn(USER_ROLES),
];

export const updateUserActiveValidators = [
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
      (field) => !USER_ACTIVE_MUTABLE_FIELDS.includes(field),
    );

    if (disallowedFields.length > 0) {
      throw new Error(
        `Unsupported fields for user activation update: ${disallowedFields.join(', ')}.`,
      );
    }

    return true;
  }),
  body('isActive').exists().isBoolean(),
];
