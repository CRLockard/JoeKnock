import { body, param } from 'express-validator';

export const createTeamValidators = [
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
];

export const getTeamValidators = [param('id').isUUID()];

export const addTeamUserValidators = [
  param('id').isUUID(),
  body('userId').isUUID(),
];
