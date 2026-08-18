import { apiFetch } from './client.js';

export function getMapProperties({ north, south, east, west }) {
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
