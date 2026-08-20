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

describe('property read APIs', () => {
  it('loads a property by id through backend /properties/:id endpoint', async () => {
    const { getPropertyById } = await import('../api/propertiesApi.js');

    apiFetch.mockResolvedValueOnce({
      propertyId: 'property-1',
      addressLine1: '123 Main St',
    });

    await getPropertyById('property-1');

    expect(apiFetch).toHaveBeenCalledWith('/properties/property-1', {
      method: 'GET',
    });
  });

  it('loads current interactions by property id through backend endpoint', async () => {
    const { getPropertyInteractions } = await import('../api/propertiesApi.js');

    apiFetch.mockResolvedValueOnce({
      propertyId: 'property-1',
      interactions: [],
    });

    await getPropertyInteractions('property-1');

    expect(apiFetch).toHaveBeenCalledWith(
      '/properties/property-1/interactions',
      {
        method: 'GET',
      },
    );
  });

  it('creates a property interaction through backend endpoint', async () => {
    const { createPropertyInteraction } =
      await import('../api/propertiesApi.js');

    const payload = {
      statusId: 'status-1',
      notes: 'Homeowner asked for follow-up.',
      contactName: 'Taylor Homeowner',
      contactPhone: '555-555-0100',
      contactEmail: 'taylor@example.com',
    };

    apiFetch.mockResolvedValueOnce({ interactionId: 'interaction-1' });

    await createPropertyInteraction('property-1', payload);

    expect(apiFetch).toHaveBeenCalledWith(
      '/properties/property-1/interactions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  });
});
