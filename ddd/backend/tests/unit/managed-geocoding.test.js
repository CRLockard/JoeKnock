import { describe, expect, it, vi } from 'vitest';
import { createManagedGeocodingProvider } from '../../src/properties/managedGeocodingProvider.js';
import { createNominatimGeocodingProvider } from '../../src/properties/geocodingProvider.js';

const address = {
  addressLine1: '123 Main',
  city: 'Test',
  state: 'TN',
  postalCode: '00000',
  country: 'US',
};
describe('managed geocoding', () => {
  it('coalesces concurrent identical coordinates and caches before a provider call', async () => {
    const provider = { reverseGeocode: vi.fn(async () => address) };
    const gate = vi.fn((fn) => fn());
    const managed = createManagedGeocodingProvider({ provider, gate });
    const coordinates = { latitude: 1, longitude: 2 };
    const responses = await Promise.all([
      managed.reverseGeocode(coordinates),
      managed.reverseGeocode(coordinates),
    ]);
    expect(responses).toEqual([address, address]);
    expect(await managed.reverseGeocode(coordinates)).toEqual(address);
    expect(provider.reverseGeocode).toHaveBeenCalledTimes(1);
    expect(gate).toHaveBeenCalledTimes(1);
  });
  it('expires results and does not cache provider failures', async () => {
    let now = 0;
    const provider = {
      reverseGeocode: vi
        .fn()
        .mockRejectedValueOnce(new Error('unavailable'))
        .mockResolvedValue(address),
    };
    const managed = createManagedGeocodingProvider({
      provider,
      gate: (fn) => fn(),
      now: () => now,
      ttlMs: 10,
    });
    const coordinates = { latitude: 1, longitude: 2 };
    await expect(managed.reverseGeocode(coordinates)).rejects.toThrow(
      'unavailable',
    );
    await managed.reverseGeocode(coordinates);
    now = 11;
    await managed.reverseGeocode(coordinates);
    expect(provider.reverseGeocode).toHaveBeenCalledTimes(3);
  });
  it('aborts an upstream request within the configured time limit', async () => {
    const provider = createNominatimGeocodingProvider({
      timeoutMs: 25,
      fetchImpl: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    });
    await expect(
      provider.reverseGeocode({ latitude: 1, longitude: 2 }),
    ).rejects.toMatchObject({ category: 'provider_timeout' });
  });
  it('configures the upstream URL and application identification', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    const provider = createNominatimGeocodingProvider({
      fetchImpl,
      baseUrl: 'https://geo.example',
      userAgent: 'TestApp contact@example.com',
    });
    await provider.reverseGeocode({ latitude: 1, longitude: 2 });
    expect(fetchImpl.mock.calls[0][0].origin).toBe('https://geo.example');
    expect(fetchImpl.mock.calls[0][1].headers['User-Agent']).toContain(
      'contact@example.com',
    );
  });
});
