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
        category: 'building',
        type: 'yes',
        place_rank: 30,
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
      precision: 'property',
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

  it.each([
    [
      'building with an alphanumeric number',
      'building',
      'residential',
      30,
      '12A',
      'property',
    ],
    ['explicit house', 'place', 'house', 30, 'Orchard Cottage', 'property'],
    ['road only', 'highway', 'residential', 26, '', 'uncertain'],
    [
      'road with a house number',
      'highway',
      'residential',
      26,
      '12',
      'uncertain',
    ],
    [
      'rank 30 road with a house number',
      'highway',
      'residential',
      30,
      '12',
      'uncertain',
    ],
    ['lower-rank house', 'place', 'house', 28, '12', 'uncertain'],
    ['house way', 'place', 'house', 30, '12', 'uncertain', 'way'],
    [
      'house with missing OSM type',
      'place',
      'house',
      30,
      '12',
      'uncertain',
      null,
    ],
    ['unnumbered building', 'building', 'yes', 30, '', 'uncertain'],
    ['missing result type', undefined, undefined, 30, '12', 'uncertain'],
    ['missing rank', 'building', 'yes', undefined, '12', 'uncertain'],
  ])(
    'classifies %s using provider evidence',
    async (
      _label,
      category,
      type,
      placeRank,
      houseNumber,
      precision,
      osmType = 'node',
    ) => {
      const fetchImpl = vi.fn(async () =>
        makeSuccessResponse({
          category,
          type,
          place_rank: placeRank,
          osm_type: osmType,
          address: {
            house_number: houseNumber,
            road: 'Main Street',
            city: 'Knoxville',
            state: 'TN',
            postcode: '37901',
            country_code: 'us',
          },
        }),
      );
      const provider = createNominatimGeocodingProvider({ fetchImpl });
      await expect(
        provider.reverseGeocode({ latitude: 35.9, longitude: -84 }),
      ).resolves.toMatchObject({ precision });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

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
