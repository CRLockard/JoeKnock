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

  return next(new ValidationError('Invalid request data.', details));
}
