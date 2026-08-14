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
