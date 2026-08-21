import { apiFetch } from './client.js';

export function resolvePropertyLocation({ latitude, longitude }) {
  // Resolution remains server-owned so geocoding + normalization + tenancy
  // checks cannot be bypassed by client-side heuristics.
  return apiFetch('/properties/resolve', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  });
}

export function getPropertyById(propertyId) {
  return apiFetch(`/properties/${propertyId}`, {
    method: 'GET',
  });
}

export function getPropertyInteractions(propertyId) {
  return apiFetch(`/properties/${propertyId}/interactions`, {
    method: 'GET',
  });
}

export function createPropertyInteraction(propertyId, payload) {
  // Initial interaction creation accepts clientRequestId to support idempotent
  // retry behavior from the map workflow.
  return apiFetch(`/properties/${propertyId}/interactions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
