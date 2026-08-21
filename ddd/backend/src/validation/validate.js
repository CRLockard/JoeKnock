import { validationResult } from 'express-validator';
import { ValidationError } from '../common/errors.js';

export function validate(req, res, next) {
  void res;
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const details = result.array().map((item) => ({
    field: item.path,
    message: item.msg,
  }));

  // Normalize express-validator output into one API error envelope so
  // frontend forms can map field-level errors consistently.
  return next(new ValidationError('Invalid request data.', details));
}
