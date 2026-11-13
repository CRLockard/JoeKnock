import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { useAuth } from '../auth/useAuth.js';
import {
  clearSession,
  loadSession,
  saveSession,
  reloadSessionFromStorage,
} from '../auth/authStorage.js';
import { apiFetch, setAuthFailureHandler } from '../api/client.js';
import { exportPropertiesCsv } from '../api/exportsApi.js';
import {
  buildInteractionDraftKey,
  DRAFT_MAX_AGE_MS,
  loadInteractionDraft,
  saveInteractionDraft,
  clearUserInteractionDrafts,
} from '../features/interactions/interactionDraftStorage.js';

const session = {
  token: 'synthetic',
  user: { id: 'user-a', organizationId: 'org-a', role: 'rep' },
};
const scope = {
  userId: 'user-a',
  organizationId: 'org-a',
  propertyId: 'property-a',
};
function Probe() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.isAuthenticated ? auth.user.id : 'signed out'}</span>
      <button onClick={auth.logout}>Sign out</button>
    </>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  clearSession();
  reloadSessionFromStorage();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearSession();
  localStorage.clear();
  setAuthFailureHandler(null);
});

describe('draft lifecycle and privacy', () => {
  it('expires an abandoned draft at seven days, rather than refreshing its age on read', () => {
    const key = buildInteractionDraftKey(scope);
    const updatedAt = new Date(Date.now() - DRAFT_MAX_AGE_MS).toISOString();
    localStorage.setItem(
      key,
      JSON.stringify({ notes: 'synthetic', updatedAt }),
    );
    expect(loadInteractionDraft(scope)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('isolates authors, orgs and edit snapshots and clears only the logged-out author', () => {
    expect(saveInteractionDraft(scope, { notes: 'private' })).toBe(true);
    saveInteractionDraft(
      { ...scope, interactionId: 'snapshot-1' },
      { notes: 'edit' },
    );
    saveInteractionDraft({ ...scope, userId: 'user-b' }, { notes: 'other' });
    expect(
      loadInteractionDraft({ ...scope, organizationId: 'org-b' }),
    ).toBeNull();
    expect(
      loadInteractionDraft({ ...scope, interactionId: 'snapshot-2' }),
    ).toBeNull();
    clearUserInteractionDrafts('user-a');
    expect(loadInteractionDraft(scope)).toBeNull();
    expect(
      loadInteractionDraft({ ...scope, interactionId: 'snapshot-1' }),
    ).toBeNull();
    expect(loadInteractionDraft({ ...scope, userId: 'user-b' }).notes).toBe(
      'other',
    );
  });
  it('reports failed storage without claiming persistence', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(saveInteractionDraft(scope, { notes: 'unsaved' })).toBe(false);
  });
  it('clears drafts on deliberate logout', () => {
    saveSession(session);
    saveInteractionDraft(scope, { notes: 'private' });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText('Sign out'));
    expect(screen.getByText('signed out')).toBeInTheDocument();
    expect(loadInteractionDraft(scope)).toBeNull();
  });
});

describe('storage and session recovery', () => {
  it('renders safely with blocked storage and supports a same-tab in-memory login', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText('signed out')).toBeInTheDocument();
    expect(saveSession(session)).toBe(false);
    expect(loadSession()).toEqual(session);
    clearSession();
    expect(loadSession()).toBeNull();
  });
  it('responds to logout in another tab', async () => {
    saveSession(session);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    localStorage.removeItem('joeknock.jwt');
    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'joeknock.jwt', newValue: null }),
      ),
    );
    expect(screen.getByText('signed out')).toBeInTheDocument();
  });
  it.each([401, 403])(
    'uses shared recovery for an export response %s',
    async (status) => {
      saveSession(session);
      const recovery = vi.fn(clearSession);
      setAuthFailureHandler(recovery);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status,
          headers: { get: () => 'application/json' },
          json: async () => ({
            error: {
              code: status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
              message: status === 401 ? 'Expired' : 'Account is inactive.',
            },
          }),
        })),
      );
      await expect(
        exportPropertiesCsv({ dateFrom: '2026-01-01', dateTo: '2026-01-02' }),
      ).rejects.toMatchObject({ status });
      expect(recovery).toHaveBeenCalledTimes(1);
      expect(loadSession()).toBeNull();
    },
  );
  it('does not log out on an ordinary permission denial', async () => {
    saveSession(session);
    const recovery = vi.fn();
    setAuthFailureHandler(recovery);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        headers: { get: () => 'application/json' },
        json: async () => ({
          error: { code: 'FORBIDDEN', message: 'Team permission denied.' },
        }),
      })),
    );
    await expect(apiFetch('/probe')).rejects.toMatchObject({ status: 403 });
    expect(recovery).not.toHaveBeenCalled();
  });
  it('does not let a late old-token failure clear a newer login', async () => {
    saveSession(session);
    let resolve;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    const request = apiFetch('/probe');
    saveSession({ ...session, token: 'new-token' });
    resolve({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: { code: 'UNAUTHENTICATED' } }),
    });
    await expect(request).rejects.toMatchObject({ status: 401 });
    await waitFor(() => expect(loadSession().token).toBe('new-token'));
  });
});
