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
import { login } from '../api/authApi.js';

vi.mock('../api/authApi.js', () => ({
  login: vi.fn(),
}));

function renderLoginFlow(initialEntries = ['/login']) {
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
                    <h2>Map Ready</h2>
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

describe('login flow', () => {
  it('stores auth state and enables protected route access on successful login', async () => {
    login.mockResolvedValue({
      token: 'token-123',
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

    const rendered = renderLoginFlow(['/login']);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'corey@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(localStorage.getItem('joeknock.jwt')).toBe('token-123');
    });

    const storedUser = JSON.parse(localStorage.getItem('joeknock.user'));
    expect(storedUser.organizationId).toBe('org-1');
    expect(storedUser.email).toBe('corey@example.com');

    rendered.unmount();
    renderLoginFlow(['/map']);
    expect(await screen.findByText('Map Ready')).toBeInTheDocument();
  });

  it('displays API authentication error on failed login', async () => {
    login.mockRejectedValue(new Error('Invalid email or password.'));

    renderLoginFlow(['/login']);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'corey@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WrongPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.',
    );
  });

  it('restores auth state from storage and allows protected route after refresh-style remount', async () => {
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

    renderLoginFlow(['/map']);

    await waitFor(() => {
      expect(screen.getByText('Map Ready')).toBeInTheDocument();
    });
  });
});
