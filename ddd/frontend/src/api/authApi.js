import { apiFetch } from './client.js';

export function register(payload) {
  // Registration is backend-owned; frontend forwards payload as-is so domain
  // validation and tenancy bootstrapping remain centralized server-side.
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logout() {
  // Stateless JWT logout is still an API call for audit/consistency, but local
  // session removal in AuthProvider is the client-side source of truth.
  return apiFetch('/auth/logout', {
    method: 'POST',
  });
}

export function getCurrentUser() {
  return apiFetch('/me', {
    method: 'GET',
  });
}
