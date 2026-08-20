import { apiFetch } from './client.js';

export function getOrganization() {
  return apiFetch('/organization', {
    method: 'GET',
  });
}

export function getOrganizationSettings() {
  return apiFetch('/organization/settings', {
    method: 'GET',
  });
}

export function updateOrganization(payload) {
  return apiFetch('/organization', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateOrganizationSettings(payload) {
  return apiFetch('/organization/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
