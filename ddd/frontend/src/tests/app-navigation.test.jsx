import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('renders drawer and account controls for authenticated users', async () => {
    setStoredSession();

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText('JoeKnock')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Corey Lopez/i }),
    ).toBeInTheDocument();
  });

  it('does not render authenticated drawer controls for unauthenticated users', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(
      screen.queryByRole('button', { name: 'Open navigation menu' }),
    ).not.toBeInTheDocument();
  });

  it('opens the user menu and exposes settings route', async () => {
    setStoredSession();

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Corey Lopez/i }));

    const settingsLink = await screen.findByRole('menuitem', {
      name: 'Settings',
    });
    expect(settingsLink).toHaveAttribute('href', '/settings?section=company');
  });

  it('renders Reports link in the drawer for manager users', async () => {
    setStoredSession('manager');

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );

    const reportsLink = await screen.findByRole('link', {
      name: 'Reports',
    });
    expect(reportsLink).toHaveAttribute('href', '/reports/activity');
  });

  it('renders Reports link in the drawer for admin users', async () => {
    setStoredSession('admin');

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );

    const reportsLink = await screen.findByRole('link', {
      name: 'Reports',
    });
    expect(reportsLink).toHaveAttribute('href', '/reports/activity');
  });

  it('does not render Reports link in the drawer for rep users', async () => {
    setStoredSession('rep');

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );

    expect(
      screen.queryByRole('link', { name: 'Reports' }),
    ).not.toBeInTheDocument();
  });

  it('provides a map route link from Settings using existing router paths', async () => {
    setStoredSession('manager');
    renderShellAtPath('/settings');

    expect(await screen.findByRole('heading', { name: 'Settings View' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute(
      'href',
      '/map',
    );
  });

  it('provides a map route link from Reports using existing router paths', async () => {
    setStoredSession('manager');
    renderShellAtPath('/reports/activity');

    expect(await screen.findByRole('heading', { name: 'Reports View' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute(
      'href',
      '/map',
    );
  });

  it('opens and closes the navigation drawer', async () => {
    setStoredSession('manager');

    render(
      <AuthProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );

    const menuButton = await screen.findByRole('button', {
      name: 'Open navigation menu',
    });

    fireEvent.click(menuButton);
    expect(
      await screen.findByRole('link', { name: 'Map' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close navigation overlay' }),
    );

    expect(screen.queryByRole('link', { name: 'Map' })).not.toBeInTheDocument();
  });
});
