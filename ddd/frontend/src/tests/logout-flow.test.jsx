import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { App } from '../app/App.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { logout } from '../api/authApi.js';

vi.mock('../api/authApi.js', () => ({
  logout: vi.fn(),
}));

function renderLogoutFlow(initialEntries = ['/map']) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route path="login" element={<LoginPage />} />
            <Route
              path="map"
              element={
                <ProtectedRoute>
                  <section>
                    <h2>Map</h2>
                  </section>
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('logout flow', () => {
  it('clears auth state and redirects to login after successful logout', async () => {
    localStorage.setItem('joeknock.jwt', 'persisted-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'admin',
        isActive: true,
      }),
    );

    logout.mockResolvedValue({ message: 'Logged out successfully.' });

    const rendered = renderLogoutFlow(['/map']);

    expect(await screen.findByText('Map')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('joeknock.jwt')).toBeNull();
      expect(localStorage.getItem('joeknock.user')).toBeNull();
    });

    expect(await screen.findByText('Login')).toBeInTheDocument();

    rendered.unmount();
    renderLogoutFlow(['/map']);
    expect(await screen.findByText('Login')).toBeInTheDocument();
  });

  it('still clears auth state when logout API call fails', async () => {
    localStorage.setItem('joeknock.jwt', 'persisted-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'user-1',
        organizationId: 'org-1',
        firstName: 'Corey',
        lastName: 'Lopez',
        email: 'corey@example.com',
        role: 'admin',
        isActive: true,
      }),
    );

    logout.mockRejectedValue(new Error('Request failed'));

    renderLogoutFlow(['/map']);

    expect(await screen.findByText('Map')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => {
      expect(localStorage.getItem('joeknock.jwt')).toBeNull();
      expect(localStorage.getItem('joeknock.user')).toBeNull();
    });

    expect(await screen.findByText('Login')).toBeInTheDocument();
  });
});
