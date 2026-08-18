import { apiFetch } from './client.js';

export function getStatuses() {
  return apiFetch('/statuses', {
    method: 'GET',
  });
}

export function createStatus(payload) {
  return apiFetch('/statuses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStatus(statusId, payload) {
  return apiFetch(`/statuses/${statusId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function setStatusActive(statusId, isActive) {
  return apiFetch(`/statuses/${statusId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
