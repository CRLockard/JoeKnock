export const SESSION_KEYS = ['joeknock.jwt', 'joeknock.user'];
const [TOKEN_KEY, USER_KEY] = SESSION_KEYS;
let volatileSession = null;
let volatileOnly = false;

function validSession(token, user) {
  return (
    typeof token === 'string' &&
    token.length > 0 &&
    user &&
    typeof user === 'object' &&
    !Array.isArray(user) &&
    typeof user.id === 'string'
  );
}

export function loadSession() {
  if (volatileOnly) return volatileSession;
  let token;
  let raw;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    raw = localStorage.getItem(USER_KEY);
  } catch {
    // Blocked storage must not prevent rendering the login page.
    return volatileSession;
  }
  if (!token || !raw) {
    volatileSession = null;
    return null;
  }
  try {
    const user = JSON.parse(raw);
    if (!validSession(token, user)) {
      clearSession();
      return null;
    }
    volatileSession = { token, user };
    return volatileSession;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session) {
  if (!validSession(session?.token, session?.user)) {
    clearSession();
    return false;
  }
  volatileSession = session;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    localStorage.setItem(TOKEN_KEY, session.token);
    volatileOnly = false;
    return true;
  } catch {
    // Remove partial writes so a reload cannot pair mismatched identity data.
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* Storage is blocked. */
    }
    volatileOnly = true;
    return false;
  }
}

export function clearSession() {
  volatileSession = null;
  volatileOnly = false;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // If removal is blocked, this tab must nevertheless stay logged out.
    volatileOnly = true;
  }
}

export function reloadSessionFromStorage() {
  volatileSession = null;
  volatileOnly = false;
  return loadSession();
}
