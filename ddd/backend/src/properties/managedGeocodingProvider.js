import { withTransaction } from '../db/transaction.js';
import {
  createNominatimGeocodingProvider,
  GeocodingProviderError,
} from './geocodingProvider.js';

// One transaction advisory lock is shared by API processes using this database.
// Reject excess traffic instead of accumulating an unbounded request queue.
async function providerGate(operation) {
  return withTransaction(async (client) => {
    const result = await client.query(
      'SELECT pg_try_advisory_xact_lock(1246708555, 1) AS acquired',
    );
    if (!result.rows[0]?.acquired) {
      throw new GeocodingProviderError(
        'Geocoding is busy. Try again shortly.',
        { category: 'provider_busy' },
      );
    }
    try {
      return await operation();
    } finally {
      // Hold the gate through a cooldown: provider request starts across
      // processes cannot be closer than 1.1 seconds, including failed requests.
      await client.query('SELECT pg_sleep(1.1)');
    }
  });
}

export function createManagedGeocodingProvider({
  provider = createNominatimGeocodingProvider(),
  gate = providerGate,
  now = Date.now,
  ttlMs = 60 * 60 * 1000,
  maxEntries = 500,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  return {
    async reverseGeocode(coordinates) {
      // Exact input coordinates avoid merging adjacent houses by rounding.
      const key = `${coordinates.latitude}:${coordinates.longitude}`;
      const existing = cache.get(key);
      if (existing && existing.expiresAt > now()) return { ...existing.value };
      cache.delete(key);
      if (pending.has(key))
        return pending.get(key).then((value) => (value ? { ...value } : null));
      const request = gate(() => provider.reverseGeocode(coordinates))
        .then((value) => {
          if (value) {
            if (cache.size >= maxEntries)
              cache.delete(cache.keys().next().value);
            cache.set(key, { value: { ...value }, expiresAt: now() + ttlMs });
          }
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, request);
      return request;
    },
  };
}

// Share de-duplication/cache across service instances in a single process;
// cross-process pacing is enforced by the database gate above.
export const managedGeocodingProvider = createManagedGeocodingProvider();
