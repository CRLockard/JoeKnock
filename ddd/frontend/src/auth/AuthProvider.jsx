import { createContext, useMemo, useState } from 'react';
import { clearSession, loadSession, saveSession } from './authStorage.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const initial = loadSession();
  const [session, setSession] = useState(initial);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token),
      token: session?.token ?? null,
      user: session?.user ?? null,
      setSession(nextSession) {
        saveSession(nextSession);
        setSession(nextSession);
      },
      logout() {
        clearSession();
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
