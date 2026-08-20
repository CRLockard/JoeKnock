import { apiFetch } from './client.js';

export function getInteractionSnapshot(interactionId) {
  return apiFetch(`/interactions/${interactionId}`, {
    method: 'GET',
  });
}

export function updateInteractionSnapshot(interactionId, payload) {
  return apiFetch(`/interactions/${interactionId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
