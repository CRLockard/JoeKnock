import { describe, expect, it, vi } from 'vitest';
import {
  createNominatimGeocodingProvider,
  GeocodingProviderError,
} from '../../src/properties/geocodingProvider.js';

function makeSuccessResponse(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    },
  };
}

describe('nominatim geocoding provider adapter', () => {
  it('converts a valid provider payload into internal address representation', async () => {
    const fetchImpl = vi.fn(async () => {
      return makeSuccessResponse({
        lat: '38.8976998',
        lon: '-77.0365532',
        address: {
          house_number: '1600',
          road: 'Pennsylvania Avenue Northwest',
          city: 'Washington',
          state: 'District of Columbia',
          postcode: '20500',
          country_code: 'us',
        },
      });
    });

    const provider = createNominatimGeocodingProvider({ fetchImpl });

    await expect(
      provider.reverseGeocode({ latitude: 38.8977, longitude: -77.0365 }),
    ).resolves.toEqual({
      addressLine1: '1600 Pennsylvania Avenue Northwest',
      addressLine2: null,
      city: 'Washington',
      state: 'District of Columbia',
      postalCode: '20500',
      country: 'US',
      latitude: 38.8976998,
      longitude: -77.0365532,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws a deterministic provider error for network failures', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    const provider = createNominatimGeocodingProvider({ fetchImpl });

    await expect(
      provider.reverseGeocode({ latitude: 35.9, longitude: -84.0 }),
    ).rejects.toMatchObject({
      name: 'GeocodingProviderError',
      category: 'network_transport_failure',
      provider: 'nominatim',
      statusCode: undefined,
      message: 'Geocoding provider request failed.',
    });
  });

  it('throws a deterministic provider error for non-2xx responses', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: false,
        status: 429,
      };
    });

    const provider = createNominatimGeocodingProvider({ fetchImpl });

    await expect(
      provider.reverseGeocode({ latitude: 35.9, longitude: -84.0 }),
    ).rejects.toMatchObject({
      name: 'GeocodingProviderError',
      category: 'provider_non_2xx',
      provider: 'nominatim',
      statusCode: 429,
      message: 'Geocoding provider request failed.',
    });
  });

  it('throws a deterministic provider error for invalid JSON', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        async json() {
          throw new Error('invalid json');
        },
      };
    });

    const provider = createNominatimGeocodingProvider({ fetchImpl });

    await expect(
      provider.reverseGeocode({ latitude: 35.9, longitude: -84.0 }),
    ).rejects.toMatchObject({
      name: 'GeocodingProviderError',
      category: 'provider_invalid_json',
      provider: 'nominatim',
      statusCode: undefined,
      message: 'Geocoding provider response was invalid.',
    });
  });

  it('returns null when response lacks required usable address data', async () => {
    const fetchImpl = vi.fn(async () => {
      return makeSuccessResponse({
        lat: '35.9004',
        lon: '-83.9988',
        address: {
          road: 'Some Road',
          state: 'TN',
          postcode: '',
          country_code: 'us',
        },
      });
    });

    const provider = createNominatimGeocodingProvider({ fetchImpl });

    const result = await provider.reverseGeocode({
      latitude: 35.9,
      longitude: -84.0,
    });

    expect(result).toBeNull();
  });

  it('exports a provider-specific error class', () => {
    expect(new GeocodingProviderError('x')).toBeInstanceOf(Error);
  });
});
