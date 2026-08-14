import { apiFetch } from './client.js';

export function getUsers(filters = {}) {
  const params = new URLSearchParams();

  if (typeof filters.active === 'boolean') {
    params.set('active', String(filters.active));
  }

  if (filters.role) {
    params.set('role', filters.role);
  }

  const queryString = params.toString();
  const path = queryString ? `/users?${queryString}` : '/users';

  return apiFetch(path);
}

export function createUser(payload) {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
