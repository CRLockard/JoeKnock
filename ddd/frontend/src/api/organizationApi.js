import { apiFetch } from './client.js';

export function getOrganization() {
  return apiFetch('/organization', {
    method: 'GET',
  });
}

export function getOrganizationSettings() {
  // Settings drive both authorization-aware UX and backend visibility/report
  // behavior, so this endpoint is a first-class workspace dependency.
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
