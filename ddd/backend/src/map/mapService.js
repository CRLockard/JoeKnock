import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { mapRepository as defaultRepository } from './mapRepository.js';

function toMarkerResponse(row) {
  return {
    propertyId: row.property_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

function validateBounds({ north, south, east, west }) {
  if (north <= south) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'north must be greater than south.',
    );
  }

  if (east <= west) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'east must be greater than west.',
    );
  }
}

export function createMapService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
    async listVisiblePropertyMarkers({
      organizationId,
      userId,
      role,
      north,
      south,
      east,
      west,
    }) {
      validateBounds({ north, south, east, west });

      const rows = await runInTransaction(async (client) => {
        const repVisibility = await repository.getRepVisibility(client, {
          organizationId,
        });

        if (!repVisibility) {
          throw new AppError(
            404,
            'RESOURCE_NOT_FOUND',
            'Organization settings not found.',
          );
        }

        return repository.listVisiblePropertyMarkers(client, {
          organizationId,
          userId,
          role,
          repVisibility,
          north,
          south,
          east,
          west,
        });
      });

      return rows.map(toMarkerResponse);
    },
  };
}
