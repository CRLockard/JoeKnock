import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  RouterProvider,
  createMemoryRouter,
} from 'react-router-dom';
import { App } from '../app/App.jsx';
import { AuthProvider } from '../auth/AuthProvider.jsx';

vi.mock('../api/authApi.js', () => ({
  logout: vi.fn().mockResolvedValue({ message: 'Logged out successfully.' }),
}));

function setStoredSession(role = 'manager') {
  localStorage.setItem('joeknock.jwt', 'token-123');
  localStorage.setItem(
    'joeknock.user',
    JSON.stringify({
      id: 'user-1',
      organizationId: 'org-1',
      firstName: 'Corey',
      lastName: 'Lopez',
      email: 'corey@example.com',
      role,
      isActive: true,
    }),
  );
}

function renderShellAtPath(pathname) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [
          { path: 'map', element: <h2>Map View</h2> },
          { path: 'settings', element: <h2>Settings View</h2> },
          {
            path: 'reports/activity',
            element: <h2>Reports View</h2>,
          },
        ],
      },
    ],
    {
      initialEntries: [pathname],
    },
  );

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
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
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute(
      'href',
      '/map',
    );
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

  it('renders Reports link for manager users', async () => {
    setStoredSession('manager');

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    const reportsLink = await screen.findByRole('link', {
      name: 'Reports',
    });
    expect(reportsLink).toHaveAttribute('href', '/reports/activity');
  });

  it('renders Reports link for admin users', async () => {
    setStoredSession('admin');

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    const reportsLink = await screen.findByRole('link', {
      name: 'Reports',
    });
    expect(reportsLink).toHaveAttribute('href', '/reports/activity');
  });

  it('does not render Reports link for rep users', async () => {
    setStoredSession('rep');

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    await screen.findByRole('link', { name: 'Settings' });

    expect(
      screen.queryByRole('link', { name: 'Reports' }),
    ).not.toBeInTheDocument();
  });

  it('provides a map route link from Settings using existing router paths', async () => {
    setStoredSession('manager');
    renderShellAtPath('/settings');

    expect(await screen.findByRole('heading', { name: 'Settings View' }));
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute(
      'href',
      '/map',
    );
  });

  it('provides a map route link from Reports using existing router paths', async () => {
    setStoredSession('manager');
    renderShellAtPath('/reports/activity');

    expect(await screen.findByRole('heading', { name: 'Reports View' }));
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute(
      'href',
      '/map',
    );
  });
});
