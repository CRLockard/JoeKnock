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
import { UsersPage } from '../pages/UsersPage.jsx';
import {
  createUser,
  getUsers,
  setUserActive,
  updateUser,
} from '../api/usersApi.js';

vi.mock('../api/usersApi.js', () => ({
  createUser: vi.fn(),
  getUsers: vi.fn(),
  setUserActive: vi.fn(),
  updateUser: vi.fn(),
}));

function setStoredUser(role) {
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

function renderUsersPage(initialEntries = ['/settings/users']) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route path="login" element={<LoginPage />} />
            <Route
              path="settings/users"
              element={
                <ProtectedRoute>
                  <UsersPage />
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
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('users page', () => {
  it('loads organization users for authorized role and applies filters', async () => {
    setStoredUser('manager');

    getUsers
      .mockResolvedValueOnce([
        {
          id: 'user-2',
          firstName: 'Ana',
          lastName: 'Manager',
          email: 'ana.manager@example.com',
          role: 'manager',
          isActive: true,
          organizationId: 'org-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'user-2',
          firstName: 'Ana',
          lastName: 'Manager',
          email: 'ana.manager@example.com',
          role: 'manager',
          isActive: true,
          organizationId: 'org-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'user-2',
          firstName: 'Ana',
          lastName: 'Manager',
          email: 'ana.manager@example.com',
          role: 'manager',
          isActive: true,
          organizationId: 'org-1',
        },
      ]);

    renderUsersPage();

    expect(
      await screen.findByText(
        'Ana Manager (ana.manager@example.com) - manager - Active',
      ),
    ).toBeInTheDocument();
    expect(getUsers).toHaveBeenCalledWith({});

    fireEvent.change(screen.getByLabelText('Active status'), {
      target: { value: 'active' },
    });
    fireEvent.change(screen.getByLabelText('Role filter'), {
      target: { value: 'manager' },
    });

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith({
        active: true,
        role: 'manager',
      });
    });
  });

  it('creates a user for authorized role', async () => {
    setStoredUser('manager');

    getUsers.mockResolvedValue([]);

    createUser.mockResolvedValue({
      id: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'rep',
      organizationId: 'org-1',
      isActive: true,
    });

    renderUsersPage();

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: 'Smith' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'rep' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'StrongPass123!',
        role: 'rep',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Created user Jane Smith.',
    );
  });

  it('updates an existing user for authorized role', async () => {
    setStoredUser('admin');

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'rep',
        organizationId: 'org-1',
        isActive: true,
      },
    ]);

    updateUser.mockResolvedValue({
      id: 'user-2',
      firstName: 'Janet',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'manager',
      organizationId: 'org-1',
      isActive: true,
    });

    renderUsersPage();

    await screen.findByText('Jane Smith (jane@example.com) - rep - Active');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Jane Smith' }));

    fireEvent.change(screen.getByLabelText('Edit first name'), {
      target: { value: 'Janet' },
    });
    fireEvent.change(screen.getByLabelText('Edit role'), {
      target: { value: 'manager' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save user' }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('user-2', {
        firstName: 'Janet',
        lastName: 'Smith',
        role: 'manager',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Updated user Janet Smith.',
    );
  });

  it('shows API error when update fails', async () => {
    setStoredUser('manager');

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'rep',
        organizationId: 'org-1',
        isActive: true,
      },
    ]);

    updateUser.mockRejectedValue(new Error('User not found.'));

    renderUsersPage();

    await screen.findByText('Jane Smith (jane@example.com) - rep - Active');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Jane Smith' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save user' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User not found.',
    );
  });

  it('shows validation error when edit form is incomplete', async () => {
    setStoredUser('admin');

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'rep',
        organizationId: 'org-1',
        isActive: true,
      },
    ]);

    renderUsersPage();

    await screen.findByText('Jane Smith (jane@example.com) - rep - Active');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Jane Smith' }));
    fireEvent.change(screen.getByLabelText('Edit first name'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save user' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'First name and last name are required for update.',
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows API error when create user fails', async () => {
    setStoredUser('admin');
    getUsers.mockResolvedValue([]);
    createUser.mockRejectedValue(new Error('Invalid request data.'));

    renderUsersPage();

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: 'Smith' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongPass123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid request data.',
    );
  });

  it('deactivates a user for admin role', async () => {
    setStoredUser('admin');

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'rep',
        organizationId: 'org-1',
        isActive: true,
      },
    ]);

    setUserActive.mockResolvedValue({
      id: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'rep',
      organizationId: 'org-1',
      isActive: false,
    });

    renderUsersPage();

    await screen.findByText('Jane Smith (jane@example.com) - rep - Active');

    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Jane Smith' }),
    );

    await waitFor(() => {
      expect(setUserActive).toHaveBeenCalledWith('user-2', false);
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Jane Smith is now inactive.',
    );
    expect(
      await screen.findByText('Jane Smith (jane@example.com) - rep - Inactive'),
    ).toBeInTheDocument();
  });

  it('reactivates an inactive user for admin role', async () => {
    setStoredUser('admin');

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'rep',
        organizationId: 'org-1',
        isActive: false,
      },
    ]);

    setUserActive.mockResolvedValue({
      id: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'rep',
      organizationId: 'org-1',
      isActive: true,
    });

    renderUsersPage();

    await screen.findByText('Jane Smith (jane@example.com) - rep - Inactive');

    fireEvent.click(
      screen.getByRole('button', { name: 'Reactivate Jane Smith' }),
    );

    await waitFor(() => {
      expect(setUserActive).toHaveBeenCalledWith('user-2', true);
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Jane Smith is now active.',
    );
  });

  it('does not render deactivate controls for manager role', async () => {
    setStoredUser('manager');

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'rep',
        organizationId: 'org-1',
        isActive: true,
      },
    ]);

    renderUsersPage();

    await screen.findByText('Jane Smith (jane@example.com) - rep - Active');

    expect(
      screen.queryByRole('button', { name: 'Deactivate Jane Smith' }),
    ).not.toBeInTheDocument();
    expect(setUserActive).not.toHaveBeenCalled();
  });

  it('shows API error when deactivate request fails', async () => {
    setStoredUser('admin');

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'rep',
        organizationId: 'org-1',
        isActive: true,
      },
    ]);

    setUserActive.mockRejectedValue(new Error('User not found.'));

    renderUsersPage();

    await screen.findByText('Jane Smith (jane@example.com) - rep - Active');

    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Jane Smith' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User not found.',
    );
  });

  it('renders representative users as non-authorized for create', async () => {
    setStoredUser('rep');

    renderUsersPage();

    expect(getUsers).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Only managers and administrators can view organization users.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Only managers and administrators can create users.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDisabled();
  });

  it('shows API error when user listing fails', async () => {
    setStoredUser('admin');
    getUsers.mockRejectedValue(new Error('Unable to load users.'));

    renderUsersPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load users.',
    );
  });
});
