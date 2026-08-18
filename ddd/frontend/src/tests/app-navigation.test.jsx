import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../app/App.jsx';
import { AuthProvider } from '../auth/AuthProvider.jsx';

vi.mock('../api/authApi.js', () => ({
  logout: vi.fn().mockResolvedValue({ message: 'Logged out successfully.' }),
}));

function setStoredSession() {
  localStorage.setItem('joeknock.jwt', 'token-123');
  localStorage.setItem(
    'joeknock.user',
    JSON.stringify({
      id: 'user-1',
      organizationId: 'org-1',
      firstName: 'Corey',
      lastName: 'Lopez',
      email: 'corey@example.com',
      role: 'manager',
      isActive: true,
    }),
  );
}

describe('app navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders Settings link for authenticated users', async () => {
    setStoredSession();

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    const settingsLink = await screen.findByRole('link', { name: 'Settings' });

    expect(settingsLink).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('does not render Settings link for unauthenticated users', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
  });

  it('points the authenticated shell link to the settings route', async () => {
    setStoredSession();

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    const settingsLink = await screen.findByRole('link', { name: 'Settings' });

    expect(settingsLink).toHaveAttribute('href', '/settings');
  });
});
