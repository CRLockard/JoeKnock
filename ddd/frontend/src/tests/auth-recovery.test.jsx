import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { apiFetch, setAuthFailureHandler } from '../api/client.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { App } from '../app/App.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { login } from '../api/authApi.js';

vi.mock('../api/authApi.js', () => ({
  login: vi.fn(),
}));

function mockJsonResponse({
  ok,
  status,
  body,
  contentType = 'application/json',
}) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        if (String(name).toLowerCase() === 'content-type') {
          return contentType;
        }

        return null;
      },
    },
    async json() {
      return body;
    },
  };
}

function ProtectedProbe({ requestPaths = ['/probe'] }) {
  useEffect(() => {
    for (const path of requestPaths) {
      void apiFetch(path).catch(() => {});
    }
  }, [requestPaths]);

  return <h2>Protected Probe</h2>;
}

function renderRecoveryFlow({ requestPaths = ['/probe'] } = {}) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/probe']}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route path="login" element={<LoginPage />} />
            <Route
              path="map"
              element={
                <ProtectedRoute>
                  <h2>Map Ready</h2>
                </ProtectedRoute>
              }
            />
            <Route
              path="probe"
              element={
                <ProtectedRoute>
                  <ProtectedProbe requestPaths={requestPaths} />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('auth recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    setAuthFailureHandler(null);
  });

  it('keeps a valid authenticated session working normally', async () => {
    localStorage.setItem('joeknock.jwt', 'valid-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'admin',
      }),
    );

    global.fetch.mockResolvedValue(
      mockJsonResponse({
        ok: true,
        status: 200,
        body: { ok: true },
      }),
    );

    renderRecoveryFlow();

    expect(
      await screen.findByRole('heading', { name: 'Protected Probe' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Corey Lopez/i }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('joeknock.jwt')).toBe('valid-token');
  });

  it('clears stored session and redirects to login when a protected API returns 401', async () => {
    localStorage.setItem('joeknock.jwt', 'stale-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'admin',
      }),
    );

    global.fetch.mockResolvedValue(
      mockJsonResponse({
        ok: false,
        status: 401,
        body: {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Invalid or expired token.',
          },
        },
      }),
    );

    renderRecoveryFlow();

    expect(
      await screen.findByRole('heading', { name: 'Login' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('joeknock.jwt')).toBeNull();
    expect(localStorage.getItem('joeknock.user')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Corey Lopez/i }),
    ).not.toBeInTheDocument();
  });

  it('deduplicates simultaneous 401 auth recovery operations', async () => {
    localStorage.setItem('joeknock.jwt', 'stale-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'admin',
      }),
    );

    const authFailureHandler = vi.fn(async () => {});
    setAuthFailureHandler(authFailureHandler);

    global.fetch.mockResolvedValue(
      mockJsonResponse({
        ok: false,
        status: 401,
        body: {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Invalid or expired token.',
          },
        },
      }),
    );

    // Concurrent failures should share one recovery execution to avoid
    // duplicate logout side effects and racey redirect churn.
    await Promise.allSettled([
      apiFetch('/one'),
      apiFetch('/two'),
      apiFetch('/three'),
    ]);

    expect(authFailureHandler).toHaveBeenCalledTimes(1);
  });

  it('does not treat a normal 403 response as auth recovery', async () => {
    localStorage.setItem('joeknock.jwt', 'valid-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'manager',
      }),
    );

    global.fetch.mockResolvedValue(
      mockJsonResponse({
        ok: false,
        status: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action.',
          },
        },
      }),
    );

    renderRecoveryFlow();

    expect(
      await screen.findByRole('heading', { name: 'Protected Probe' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(localStorage.getItem('joeknock.jwt')).toBe('valid-token');
    });

    expect(
      screen.getByRole('button', { name: /Corey Lopez/i }),
    ).toBeInTheDocument();
  });

  it('allows normal login after automatic session recovery', async () => {
    localStorage.setItem('joeknock.jwt', 'stale-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'admin',
      }),
    );

    global.fetch.mockResolvedValueOnce(
      mockJsonResponse({
        ok: false,
        status: 401,
        body: {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Invalid or expired token.',
          },
        },
      }),
    );

    login.mockResolvedValue({
      token: 'fresh-token',
      user: {
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'admin',
        isActive: true,
      },
    });

    renderRecoveryFlow();

    expect(
      await screen.findByRole('heading', { name: 'Login' }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'corey@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(
      await screen.findByRole('heading', { name: 'Map Ready' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('joeknock.jwt')).toBe('fresh-token');
  });
});
