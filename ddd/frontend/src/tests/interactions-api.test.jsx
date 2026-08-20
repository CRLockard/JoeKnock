import { describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();

vi.mock('../api/client.js', () => ({
  apiFetch,
}));

describe('interaction snapshot APIs', () => {
  it('loads a single interaction snapshot from backend endpoint', async () => {
    const { getInteractionSnapshot } =
      await import('../api/interactionsApi.js');

    apiFetch.mockResolvedValueOnce({
      interactionId: 'interaction-1',
      statusName: 'Interested',
    });

    await getInteractionSnapshot('interaction-1');

    expect(apiFetch).toHaveBeenCalledWith('/interactions/interaction-1', {
      method: 'GET',
    });
  });

  it('updates an interaction by creating a new snapshot through backend endpoint', async () => {
    const { updateInteractionSnapshot } =
      await import('../api/interactionsApi.js');

    const payload = {
      statusId: 'status-2',
      notes: 'Updated after follow-up.',
      contactName: 'Pat Homeowner',
      contactPhone: '555-555-0111',
      contactEmail: 'pat@example.com',
    };

    apiFetch.mockResolvedValueOnce({
      interactionId: 'interaction-2',
      interactionGroupId: 'group-1',
    });

    await updateInteractionSnapshot('interaction-1', payload);

    expect(apiFetch).toHaveBeenCalledWith('/interactions/interaction-1', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });
});
