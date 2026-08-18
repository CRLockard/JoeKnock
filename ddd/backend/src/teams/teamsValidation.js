import { body } from 'express-validator';

export const createTeamValidators = [
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
];
