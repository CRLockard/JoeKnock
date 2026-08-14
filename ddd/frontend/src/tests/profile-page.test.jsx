import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { App } from '../app/App.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { getCurrentUser } from '../api/authApi.js';

vi.mock('../api/authApi.js', () => ({
  getCurrentUser: vi.fn(),
}));

function renderProfile(initialEntries = ['/profile']) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route path="login" element={<LoginPage />} />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
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
  localStorage.setItem('joeknock.jwt', 'token-123');
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('profile page', () => {
  it('loads and renders current-user profile data', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'user-1',
      firstName: 'Corey',
      lastName: 'Lopez',
      email: 'corey@example.com',
      role: 'admin',
      organizationId: 'org-1',
      teams: [],
    });

    renderProfile(['/profile']);

    expect(await screen.findByText('Profile')).toBeInTheDocument();

    await waitFor(() => {
      expect(getCurrentUser).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Corey Lopez')).toBeInTheDocument();
    expect(screen.getByText('corey@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('org-1')).toBeInTheDocument();
  });

  it('renders API error when current-user request fails', async () => {
    getCurrentUser.mockRejectedValue(new Error('Invalid or expired token.'));

    renderProfile(['/profile']);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid or expired token.',
    );
  });
});
