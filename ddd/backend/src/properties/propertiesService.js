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
