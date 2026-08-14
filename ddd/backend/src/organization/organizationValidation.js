import { body } from 'express-validator';

export const updateOrganizationValidators = [
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
];
