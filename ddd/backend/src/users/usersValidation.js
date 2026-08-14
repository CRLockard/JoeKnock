import { body } from 'express-validator';

export const createUserValidators = [
  body('firstName').isString().trim().notEmpty().isLength({ max: 100 }),
  body('lastName').isString().trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('role').isString().trim().isIn(['admin', 'manager', 'rep']),
];
