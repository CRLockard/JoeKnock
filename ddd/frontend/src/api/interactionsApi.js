import { apiFetch } from './client.js';

export function getInteractionSnapshot(interactionId) {
  return apiFetch(`/interactions/${interactionId}`, {
    method: 'GET',
  });
}

export function updateInteractionSnapshot(interactionId, payload) {
  // Revisions create new immutable snapshots on backend, so client calls this
  // as an update action while data model remains append-only.
  return apiFetch(`/interactions/${interactionId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
