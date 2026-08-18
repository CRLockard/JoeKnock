import { query } from 'express-validator';

export const mapPropertiesQueryValidators = [
  query('north')
    .exists({ checkFalsy: true })
    .withMessage('north is required.')
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage('north must be between -90 and 90.')
    .toFloat(),
  query('south')
    .exists({ checkFalsy: true })
    .withMessage('south is required.')
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage('south must be between -90 and 90.')
    .toFloat(),
  query('east')
    .exists({ checkFalsy: true })
    .withMessage('east is required.')
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage('east must be between -180 and 180.')
    .toFloat(),
  query('west')
    .exists({ checkFalsy: true })
    .withMessage('west is required.')
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage('west must be between -180 and 180.')
    .toFloat(),
];
