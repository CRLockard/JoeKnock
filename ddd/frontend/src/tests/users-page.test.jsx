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
import { createUser } from '../api/usersApi.js';

vi.mock('../api/usersApi.js', () => ({
  createUser: vi.fn(),
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
  it('creates a user for authorized role', async () => {
    setStoredUser('manager');

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

  it('shows API error when create user fails', async () => {
    setStoredUser('admin');
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

  it('renders representative users as non-authorized for create', async () => {
    setStoredUser('rep');

    renderUsersPage();

    expect(
      screen.getByText('Only managers and administrators can create users.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDisabled();
  });
});
