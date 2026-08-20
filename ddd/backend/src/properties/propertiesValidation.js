import { body, param } from 'express-validator';

const MUTABLE_FIELDS = ['latitude', 'longitude'];

export const resolvePropertyValidators = [
  body().custom((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Request body must be an object.');
    }

    const providedFields = Object.keys(value);

    if (providedFields.length === 0) {
      throw new Error('latitude and longitude are required.');
    }

    const disallowedFields = providedFields.filter(
      (field) => !MUTABLE_FIELDS.includes(field),
    );

    if (disallowedFields.length > 0) {
      throw new Error(
        `Unsupported fields for property resolution: ${disallowedFields.join(', ')}.`,
      );
    }

    return true;
  }),
  body('latitude')
    .exists()
    .withMessage('latitude is required.')
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90.')
    .toFloat(),
  body('longitude')
    .exists()
    .withMessage('longitude is required.')
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180.')
    .toFloat(),
];

export const getPropertyValidators = [
  param('id').isUUID().withMessage('id must be a valid UUID.'),
];

export const getPropertyInteractionsValidators = [
  param('propertyId').isUUID().withMessage('propertyId must be a valid UUID.'),
];
