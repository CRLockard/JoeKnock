import { getPool } from '../db/client.js';
import {
  createNominatimGeocodingProvider,
  GeocodingProviderError,
} from './geocodingProvider.js';

function busyError() {
  return new GeocodingProviderError('Geocoding is busy. Try again shortly.', {
    category: 'provider_busy',
  });
}

function coordinationError() {
  return new GeocodingProviderError('Geocoding coordination is unavailable.', {
    category: 'provider_coordination_unavailable',
  });
}

export function createProviderGate({ pool = getPool } = {}) {
  let active = false;
  return async (operation) => {
    if (active) throw busyError();
    active = true;
    let client;
    let locked = false;
    let connectionFailed = false;
    let destroyClient = false;
    const controller = new AbortController();
    const onConnectionError = () => {
      connectionFailed = true;
      controller.abort();
    };

    try {
      try {
        client = await pool().connect();
        client.on('error', onConnectionError);
        const lock = await client.query(
          'SELECT pg_try_advisory_lock(1246708555, 1) AS acquired',
        );
        if (!lock.rows[0]?.acquired) throw busyError();
        locked = true;
        // The fallback lease covers the maximum provider timeout plus the
        // cooldown if this process or its database connection disappears.
        const reservationStarted = performance.now();
        const reservation = await client.query(`
          UPDATE geocoding_pacing
          SET available_at = clock_timestamp() + interval '32 seconds'
          WHERE singleton = true AND available_at <= clock_timestamp()
          RETURNING singleton
        `);
        if (!reservation.rowCount) {
          const row = await client.query(
            'SELECT singleton FROM geocoding_pacing WHERE singleton = true',
          );
          if (!row.rowCount) throw coordinationError();
          throw busyError();
        }
        if (connectionFailed || performance.now() - reservationStarted > 500) {
          throw coordinationError();
        }
      } catch (error) {
        if (error instanceof GeocodingProviderError) throw error;
        destroyClient = true;
        throw coordinationError();
      }

      let value;
      let providerError;
      let providerFailed = false;
      try {
        value = await operation(controller.signal);
      } catch (error) {
        providerFailed = true;
        providerError = error;
      }
      try {
        if (connectionFailed) throw coordinationError();
        const updated = await client.query(`
          UPDATE geocoding_pacing
          SET available_at = clock_timestamp() + interval '1.1 seconds'
          WHERE singleton = true
        `);
        if (updated.rowCount !== 1) throw coordinationError();
      } catch {
        destroyClient = true;
        throw coordinationError();
      }
      if (providerFailed) throw providerError;
      return value;
    } finally {
      let unlockFailed = false;
      if (client) {
        if (locked && !destroyClient && !connectionFailed) {
          try {
            const result = await client.query(
              'SELECT pg_advisory_unlock(1246708555, 1) AS released',
            );
            if (!result.rows[0]?.released) {
              destroyClient = true;
              unlockFailed = true;
            }
          } catch {
            destroyClient = true;
            unlockFailed = true;
          }
        } else if (connectionFailed) {
          destroyClient = true;
        }
      }
      try {
        if (client) {
          client.removeListener('error', onConnectionError);
          client.release(destroyClient || connectionFailed);
        }
      } finally {
        active = false;
      }
      if (unlockFailed) throw coordinationError();
    }
  };
}

const providerGate = createProviderGate();

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
      const request = gate((signal) =>
        provider.reverseGeocode({ ...coordinates, signal }),
      )
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
