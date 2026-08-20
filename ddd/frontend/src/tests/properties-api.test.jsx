import { describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();

vi.mock('../api/client.js', () => ({
  apiFetch,
}));

describe('resolvePropertyLocation', () => {
  it('routes property resolution through backend /properties/resolve endpoint', async () => {
    const { resolvePropertyLocation } = await import('../api/propertiesApi.js');

    apiFetch.mockResolvedValueOnce({
      property: {
        propertyId: 'property-1',
        latitude: 35.9,
        longitude: -84,
      },
      created: false,
    });

    await resolvePropertyLocation({ latitude: 35.9, longitude: -84.0 });

    expect(apiFetch).toHaveBeenCalledWith('/properties/resolve', {
      method: 'POST',
      body: JSON.stringify({ latitude: 35.9, longitude: -84.0 }),
    });
  });
});
