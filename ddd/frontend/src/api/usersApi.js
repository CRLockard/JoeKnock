import { apiFetch } from './client.js';

export function createUser(payload) {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
