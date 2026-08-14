import { body } from 'express-validator';

function isValidIanaTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

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
    .custom((value) => isValidIanaTimeZone(value)),
];
