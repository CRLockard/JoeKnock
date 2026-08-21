import { config } from '../config/env.js';
import { loadSession } from '../auth/authStorage.js';

let authFailureHandler = null;
let authRecoveryPromise = null;

export function setAuthFailureHandler(handler) {
  authFailureHandler = handler;
}

function shouldRecoverAuthentication({ response, body, session }) {
  // Only trigger global auth recovery when the client believed it had a
  // session. Public endpoint failures should not force a logout transition.
  if (!session?.token) {
    return false;
  }

  return response.status === 401 || body?.error?.code === 'UNAUTHENTICATED';
}

async function recoverAuthentication() {
  if (!authFailureHandler) {
    return;
  }

  // Multiple concurrent protected requests can fail together after token
  // expiry. Reuse one in-flight recovery to avoid repeated session clears
  // and route churn.
  if (!authRecoveryPromise) {
    authRecoveryPromise = Promise.resolve()
      .then(() => authFailureHandler())
      .finally(() => {
        authRecoveryPromise = null;
      });
  }

  await authRecoveryPromise;
}

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
    // Centralized auth recovery keeps 401 handling consistent across pages
    // and API modules instead of duplicating logout logic at call sites.
    if (shouldRecoverAuthentication({ response, body, session })) {
      await recoverAuthentication();
    }

    const message = body?.error?.message ?? 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.code = body?.error?.code;
    error.details = body?.error?.details;
    throw error;
  }

  return body;
}
