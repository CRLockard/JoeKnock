import { body } from 'express-validator';
import { isValidIanaTimeZone } from '../common/timezone.js';

export const registerValidators = [
  body('organizationName').isString().trim().notEmpty(),
  body('firstName').isString().trim().notEmpty(),
  body('lastName').isString().trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('timezone')
    .isString()
    .trim()
    .notEmpty()
    .bail()
    // Accept only valid IANA names so report/export date semantics stay stable.
    .custom((value) => isValidIanaTimeZone(value)),
];

export const loginValidators = [
  body('email').isEmail().normalizeEmail(),
  // Passwords are opaque secrets: creation hashes the exact input, including spaces.
  body('password').isString().notEmpty(),
];
