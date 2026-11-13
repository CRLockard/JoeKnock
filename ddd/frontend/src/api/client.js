import { config } from '../config/env.js';
import { loadSession, clearSession } from '../auth/authStorage.js';

let authFailureHandler = null;
let authRecoveryPromise = null;

export function setAuthFailureHandler(handler) {
  authFailureHandler = handler;
}

async function recoverAuthentication() {
  if (!authRecoveryPromise) {
    authRecoveryPromise = Promise.resolve()
      .then(() => (authFailureHandler ? authFailureHandler() : clearSession()))
      .finally(() => {
        authRecoveryPromise = null;
      });
  }
  await authRecoveryPromise;
}

// One transport for JSON APIs and Blob exports so expiry handling cannot drift.
export async function apiRequest(path, options = {}) {
  const session = loadSession();
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...options,
    headers,
  });
  const hasJson = (response.headers.get('content-type') ?? '').includes(
    'application/json',
  );
  const body = hasJson ? await response.json() : null;
  if (!response.ok) {
    const inactive =
      response.status === 403 &&
      (body?.error?.code === 'ACCOUNT_INACTIVE' ||
        /^Account is inactive\.?$/i.test(body?.error?.message ?? ''));
    // A late response from an older login must not clear a newer session.
    if (
      session?.token &&
      loadSession()?.token === session.token &&
      (response.status === 401 ||
        body?.error?.code === 'UNAUTHENTICATED' ||
        inactive)
    ) {
      await recoverAuthentication();
    }
    const error = new Error(body?.error?.message ?? 'Request failed');
    error.status = response.status;
    error.code = body?.error?.code;
    error.details = body?.error?.details;
    throw error;
  }
  return { response, body };
}

export async function apiFetch(path, options = {}) {
  return (await apiRequest(path, options)).body;
}
