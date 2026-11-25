import { describe, expect, it, vi } from 'vitest';
import { createNominatimGeocodingProvider } from '../../src/properties/geocodingProvider.js';
import { createPropertiesService } from '../../src/properties/propertiesService.js';

describe('property resolution precision', () => {
  it('does not create or reuse a property for two road-only results', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        lat: '35.9',
        lon: '-84',
        address: {
          road: 'Main Street',
          city: 'Knoxville',
          state: 'TN',
          postcode: '37901',
          country_code: 'us',
        },
      }),
    }));
    let storedProperty;
    const repository = {
      findByNormalizedAddress: vi.fn(async () => storedProperty),
      createProperty: vi.fn(async (_client, payload) => {
        storedProperty = {
          id: 'property-1',
          latitude: payload.latitude,
          longitude: payload.longitude,
        };
        return storedProperty;
      }),
    };
    const service = createPropertiesService({
      geocodingProvider: createNominatimGeocodingProvider({ fetchImpl }),
      repository,
      runInTransaction: async (operation) => operation({}),
    });

    for (const latitude of [35.9, 35.91]) {
      await expect(
        service.resolveProperty({
          organizationId: 'org-1',
          latitude,
          longitude: -84,
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'PROPERTY_LOCATION_UNRESOLVABLE',
        message:
          'We couldn’t identify a specific property here. Try tapping closer to the building.',
      });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(repository.findByNormalizedAddress).not.toHaveBeenCalled();
    expect(repository.createProperty).not.toHaveBeenCalled();
  });
});
