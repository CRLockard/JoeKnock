import { body, query } from 'express-validator';

const USER_ROLES = ['admin', 'manager', 'rep'];

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
      throw new Error(
        'teamId filtering is not available until team foundation tickets are implemented.',
      );
    }),
];
