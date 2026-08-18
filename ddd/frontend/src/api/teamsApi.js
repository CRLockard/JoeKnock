import { apiFetch } from './client.js';

export function createTeam(payload) {
  return apiFetch('/teams', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
