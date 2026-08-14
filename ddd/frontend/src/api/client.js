import { config } from '../config/env.js';
import { loadSession } from '../auth/authStorage.js';

export async function apiFetch(path, options = {}) {
  const session = loadSession();
  const headers = new Headers(options.headers ?? {});

  headers.set('Content-Type', 'application/json');

  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const hasJson = contentType.includes('application/json');
  const body = hasJson ? await response.json() : null;

  if (!response.ok) {
    const message = body?.error?.message ?? 'Request failed';
    throw new Error(message);
  }

  return body;
}
