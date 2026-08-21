import { AppError } from '../common/errors.js';
import { logger } from '../common/logger.js';
import { withTransaction } from '../db/transaction.js';
import { normalizeResolvedAddress } from './addressNormalization.js';
import {
  createNominatimGeocodingProvider,
  GeocodingProviderError,
} from './geocodingProvider.js';
import { propertiesRepository as defaultRepository } from './propertiesRepository.js';

function isUniqueViolation(error) {
  return error && error.code === '23505';
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPropertyResponse(row) {
  return {
    propertyId: row.id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

function toPropertyDetailResponse(row) {
  return {
    propertyId: row.id,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

function toIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

function toCurrentInteractionResponse(row) {
  return {
    interactionId: row.interaction_id,
    interactionGroupId: row.interaction_group_id,
    userId: row.user_id,
    statusId: row.status_id,
    statusName: row.status_name,
    initialInteractionAt: toIsoTimestamp(row.initial_interaction_at),
    changedAt: toIsoTimestamp(row.changed_at),
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    notes: row.notes,
  };
}

function toUnresolvableError() {
  return new AppError(
    422,
    'PROPERTY_LOCATION_UNRESOLVABLE',
    'The selected map location could not be resolved to a valid property address.',
  );
}

function normalizeResolvedCoordinates({ resolved, requested }) {
  const lat = toFiniteNumber(resolved.latitude) ?? requested.latitude;
  const lon = toFiniteNumber(resolved.longitude) ?? requested.longitude;

  return {
    latitude: lat,
    longitude: lon,
  };
}

export function createPropertiesService({
  repository = defaultRepository,
  geocodingProvider = createNominatimGeocodingProvider(),
  runInTransaction = withTransaction,
} = {}) {
  return {
    async getPropertyById({ organizationId, propertyId }) {
      const property = await runInTransaction(async (client) => {
        return repository.findById(client, { organizationId, propertyId });
      });

      if (!property) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Property not found.');
      }

      return toPropertyDetailResponse(property);
    },

    async listCurrentPropertyInteractions({
      organizationId,
      userId,
      role,
      propertyId,
    }) {
      const result = await runInTransaction(async (client) => {
        const property = await repository.findById(client, {
          organizationId,
          propertyId,
        });

        if (!property) {
          throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Property not found.');
        }

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

        // Visibility is applied in repository SQL so every caller path shares
        // one enforcement point for org + role + team-based access rules.
        const rows = await repository.listCurrentVisibleInteractions(client, {
          organizationId,
          userId,
          role,
          repVisibility,
          propertyId,
        });

        return rows;
      });

      return {
        propertyId,
        interactions: result.map(toCurrentInteractionResponse),
      };
    },

    async resolveProperty({ organizationId, latitude, longitude, requestId }) {
      let resolved;

      try {
        resolved = await geocodingProvider.reverseGeocode({
          latitude,
          longitude,
        });
      } catch (error) {
        const provider =
          error instanceof GeocodingProviderError
            ? error.provider
            : 'unknown_provider';
        const category =
          error instanceof GeocodingProviderError
            ? error.category
            : 'unexpected_provider_exception';

        logger.warn('property_resolution_geocoding_provider_failure', {
          requestId,
          operation: 'properties.resolve',
          provider,
          failureCategory: category,
          providerHttpStatus:
            error instanceof GeocodingProviderError
              ? (error.statusCode ?? null)
              : null,
        });

        throw new AppError(
          500,
          'INTERNAL_SERVER_ERROR',
          'Unable to resolve the selected location right now.',
        );
      }

      if (!resolved) {
        logger.warn('property_resolution_location_unresolvable', {
          requestId,
          operation: 'properties.resolve',
          provider: 'nominatim',
          failureCategory: 'provider_unusable_address',
        });
        throw toUnresolvableError();
      }

      const normalizedAddress = normalizeResolvedAddress(resolved);

      if (!normalizedAddress) {
        logger.warn('property_resolution_location_unresolvable', {
          requestId,
          operation: 'properties.resolve',
          provider: 'nominatim',
          failureCategory: 'address_normalization_empty',
        });
        throw toUnresolvableError();
      }

      const coordinates = normalizeResolvedCoordinates({
        resolved,
        requested: { latitude, longitude },
      });

      const payload = {
        addressLine1: resolved.addressLine1,
        addressLine2: resolved.addressLine2 ?? null,
        city: resolved.city,
        state: resolved.state,
        postalCode: resolved.postalCode,
        country: resolved.country,
        normalizedAddress,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };

      try {
        const result = await runInTransaction(async (client) => {
          // Resolve-by-address first to keep one canonical property per org
          // location and prevent duplicate markers from repeat geocoding calls.
          const existing = await repository.findByNormalizedAddress(client, {
            organizationId,
            normalizedAddress,
          });

          if (existing) {
            return {
              property: existing,
              created: false,
            };
          }

          const created = await repository.createProperty(client, {
            organizationId,
            ...payload,
          });

          return {
            property: created,
            created: true,
          };
        });

        return {
          property: toPropertyResponse(result.property),
          created: result.created,
        };
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        const existing = await runInTransaction(async (client) => {
          return repository.findByNormalizedAddress(client, {
            organizationId,
            normalizedAddress,
          });
        });

        if (!existing) {
          throw error;
        }

        return {
          property: toPropertyResponse(existing),
          created: false,
        };
      }
    },
  };
}
