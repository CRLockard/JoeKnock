import { createContext, useEffect, useMemo, useState } from 'react';
import { setAuthFailureHandler } from '../api/client.js';
import {
  clearSession,
  loadSession,
  saveSession,
  reloadSessionFromStorage,
  SESSION_KEYS,
} from './authStorage.js';
import { clearUserInteractionDrafts } from '../features/interactions/interactionDraftStorage.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Session hydration is synchronous so protected routes can render from a
  // known auth state on first paint.
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    // apiFetch delegates token-expiry handling here so auth teardown behavior
    // remains consistent regardless of which page triggered the failing call.
    setAuthFailureHandler(() => {
      clearSession();
      setSession(null);
    });

    const onStorage = (event) => {
      if (event.key === null || SESSION_KEYS.includes(event.key)) {
        setSession(reloadSessionFromStorage());
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      setAuthFailureHandler(null);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

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
        clearUserInteractionDrafts(session?.user?.id);
        clearSession();
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
