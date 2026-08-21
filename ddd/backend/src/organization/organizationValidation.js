import { body } from 'express-validator';

const ORG_SETTINGS_FIELDS = ['rep_visibility', 'timezone'];
const REP_VISIBILITY_VALUES = ['own', 'team', 'organization'];

function isValidIanaTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const updateOrganizationValidators = [
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
];

export const updateOrganizationSettingsValidators = [
  body().custom((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Request body must be an object.');
    }

    const providedFields = Object.keys(value);

    if (providedFields.length === 0) {
      throw new Error('At least one updatable field is required.');
    }

    const disallowedFields = providedFields.filter(
      (field) => !ORG_SETTINGS_FIELDS.includes(field),
    );

    // Reject unknown keys to keep frontend and API payload contracts explicit.
    if (disallowedFields.length > 0) {
      throw new Error(
        `Unsupported fields for organization settings update: ${disallowedFields.join(', ')}.`,
      );
    }

    return true;
  }),
  body('rep_visibility')
    .optional()
    .isString()
    .trim()
    .isIn(REP_VISIBILITY_VALUES),
  body('timezone')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .bail()
    .custom((value) => isValidIanaTimeZone(value)),
];
