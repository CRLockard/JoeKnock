import { AppError, AuthError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { organizationRepository as defaultRepository } from './organizationRepository.js';

function toOrganizationResponse(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOrganizationSettingsResponse(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    repVisibility: row.rep_visibility,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function invalidAuthContextError() {
  return new AuthError('Invalid or expired token.');
}

export function createOrganizationService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
    async getOrganization({ organizationId }) {
      const organization = await runInTransaction(async (client) => {
        return repository.findOrganizationById(client, { organizationId });
      });

      if (!organization) {
        throw invalidAuthContextError();
      }

      return toOrganizationResponse(organization);
    },

    async getOrganizationSettings({ organizationId }) {
      const settings = await runInTransaction(async (client) => {
        return repository.findOrganizationSettingsByOrganizationId(client, {
          organizationId,
        });
      });

      if (!settings) {
        throw new AppError(
          404,
          'RESOURCE_NOT_FOUND',
          'Organization settings not found.',
        );
      }

      return toOrganizationSettingsResponse(settings);
    },

    async updateOrganizationSettings({
      organizationId,
      repVisibility,
      timezone,
    }) {
      const updatedSettings = await runInTransaction(async (client) => {
        return repository.updateOrganizationSettings(client, {
          organizationId,
          repVisibility,
          timezone,
        });
      });

      if (!updatedSettings) {
        throw new AppError(
          404,
          'RESOURCE_NOT_FOUND',
          'Organization settings not found.',
        );
      }

      return toOrganizationSettingsResponse(updatedSettings);
    },

    async updateOrganization({ organizationId, name }) {
      const normalizedName = String(name).trim();

      const organization = await runInTransaction(async (client) => {
        return repository.updateOrganizationName(client, {
          organizationId,
          name: normalizedName,
        });
      });

      if (!organization) {
        throw invalidAuthContextError();
      }

      if (!organization.name) {
        throw new AppError(
          500,
          'INTERNAL_SERVER_ERROR',
          'Organization update failed.',
        );
      }

      return toOrganizationResponse(organization);
    },
  };
}
