import { body, param } from 'express-validator';

const CREATE_FIELDS = [
  'clientRequestId',
  'statusId',
  'contactName',
  'contactPhone',
  'contactEmail',
  'notes',
];

const UPDATE_FIELDS = [
  'statusId',
  'contactName',
  'contactPhone',
  'contactEmail',
  'notes',
];

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length === 0 ? null : normalized;
}

function enforceBodyObjectWithAllowedFields(allowedFields) {
  return body().custom((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Request body must be an object.');
    }

    const providedFields = Object.keys(value);
    const disallowedFields = providedFields.filter(
      (field) => !allowedFields.includes(field),
    );

    if (disallowedFields.length > 0) {
      throw new Error(
        `Unsupported fields for interaction request: ${disallowedFields.join(', ')}.`,
      );
    }

    return true;
  });
}

export const createInteractionValidators = [
  param('propertyId').isUUID().withMessage('propertyId must be a valid UUID.'),
  enforceBodyObjectWithAllowedFields(CREATE_FIELDS),
  body('clientRequestId')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('clientRequestId must be a valid UUID when provided.'),
  body('statusId')
    .exists()
    .withMessage('statusId is required.')
    .bail()
    .isUUID()
    .withMessage('statusId must be a valid UUID.'),
  body('contactName')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isLength({ max: 255 })
    .withMessage('contactName must be at most 255 characters.'),
  body('contactPhone')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isLength({ max: 50 })
    .withMessage('contactPhone must be at most 50 characters.'),
  body('contactEmail')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isLength({ max: 255 })
    .withMessage('contactEmail must be at most 255 characters.'),
  body('notes')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isString()
    .withMessage('notes must be a string when provided.'),
];

export const getInteractionValidators = [
  param('id').isUUID().withMessage('id must be a valid UUID.'),
];

export const updateInteractionValidators = [
  param('id').isUUID().withMessage('id must be a valid UUID.'),
  enforceBodyObjectWithAllowedFields(UPDATE_FIELDS),
  body().custom((value) => {
    const hasAtLeastOneField = UPDATE_FIELDS.some(
      (field) => value[field] !== undefined,
    );

    if (!hasAtLeastOneField) {
      throw new Error('At least one updatable field is required.');
    }

    return true;
  }),
  body('statusId')
    .optional()
    .isUUID()
    .withMessage('statusId must be a valid UUID when provided.'),
  body('contactName')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isLength({ max: 255 })
    .withMessage('contactName must be at most 255 characters.'),
  body('contactPhone')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isLength({ max: 50 })
    .withMessage('contactPhone must be at most 50 characters.'),
  body('contactEmail')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isLength({ max: 255 })
    .withMessage('contactEmail must be at most 255 characters.'),
  body('notes')
    .optional({ nullable: true })
    .customSanitizer(normalizeOptionalText)
    .isString()
    .withMessage('notes must be a string when provided.'),
];
