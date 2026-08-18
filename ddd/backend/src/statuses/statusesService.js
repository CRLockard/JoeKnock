import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { statusesRepository as defaultRepository } from './statusesRepository.js';

function toStatusResponse(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeDescription(description) {
  if (description === undefined || description === null) {
    return null;
  }

  const normalized = String(description).trim();
  return normalized.length === 0 ? null : normalized;
}

function hasAnyUpdatableField({ name, description, displayOrder }) {
  return (
    name !== undefined ||
    description !== undefined ||
    displayOrder !== undefined
  );
}

export function createStatusesService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
    async listActiveStatuses({ organizationId }) {
      const rows = await runInTransaction(async (client) => {
        return repository.listActiveStatuses(client, { organizationId });
      });

      return rows.map(toStatusResponse);
    },

    async createStatus({ organizationId, name, description, displayOrder }) {
      const createdStatus = await runInTransaction(async (client) => {
        return repository.createStatus(client, {
          organizationId,
          name: String(name).trim(),
          description: normalizeDescription(description),
          displayOrder,
          isActive: true,
        });
      });

      if (!createdStatus) {
        throw new AppError(
          500,
          'INTERNAL_SERVER_ERROR',
          'Status creation failed.',
        );
      }

      return toStatusResponse(createdStatus);
    },

    async updateStatus({
      organizationId,
      statusId,
      name,
      description,
      displayOrder,
    }) {
      if (!hasAnyUpdatableField({ name, description, displayOrder })) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'At least one updatable field is required.',
        );
      }

      const updatedStatus = await runInTransaction(async (client) => {
        return repository.updateStatus(client, {
          organizationId,
          statusId,
          name: name !== undefined ? String(name).trim() : undefined,
          description:
            description !== undefined
              ? normalizeDescription(description)
              : undefined,
          displayOrder,
        });
      });

      if (!updatedStatus) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Status not found.');
      }

      return toStatusResponse(updatedStatus);
    },

    async setStatusActive({ organizationId, statusId, isActive }) {
      const updatedStatus = await runInTransaction(async (client) => {
        return repository.setStatusActive(client, {
          organizationId,
          statusId,
          isActive,
        });
      });

      if (!updatedStatus) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Status not found.');
      }

      return toStatusResponse(updatedStatus);
    },
  };
}
