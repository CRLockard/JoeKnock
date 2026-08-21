import { apiFetch } from './client.js';

export function getMapProperties({ north, south, east, west }) {
  // Map queries are viewport-scoped so backend can enforce org + visibility
  // rules while minimizing payload size for frequent pan/zoom refreshes.
  const params = new URLSearchParams({
    north: String(north),
    south: String(south),
    east: String(east),
    west: String(west),
  });

  return apiFetch(`/map/properties?${params.toString()}`, {
    method: 'GET',
  });
}
