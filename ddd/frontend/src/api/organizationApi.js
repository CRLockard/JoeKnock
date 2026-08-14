import { apiFetch } from './client.js';

export function getOrganization() {
  return apiFetch('/organization', {
    method: 'GET',
  });
}

export function updateOrganization(payload) {
  return apiFetch('/organization', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
