import { apiFetch } from './client.js';

export function resolvePropertyLocation({ latitude, longitude }) {
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
  return apiFetch(`/properties/${propertyId}/interactions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
