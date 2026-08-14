const TOKEN_KEY = 'joeknock.jwt';
const USER_KEY = 'joeknock.user';

export function loadSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);

  if (!token || !userRaw) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(userRaw),
    };
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
