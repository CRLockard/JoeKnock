import { body, param } from 'express-validator';

export const createTeamValidators = [
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
];

export const getTeamValidators = [param('id').isUUID()];

export const addTeamUserValidators = [
  // Team and user identifiers are fully server-validated before service logic.
  param('id').isUUID(),
  body('userId').isUUID(),
];

export const removeTeamUserValidators = [
  param('id').isUUID(),
  param('userId').isUUID(),
];
