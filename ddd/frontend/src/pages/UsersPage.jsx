import { useEffect, useState } from 'react';
import { createUser, getUsers } from '../api/usersApi.js';
import { useAuth } from '../auth/useAuth.js';

const DEFAULT_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'rep',
};

export function UsersPage() {
  const auth = useAuth();
  const [users, setUsers] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageUsers =
    auth.user?.role === 'admin' || auth.user?.role === 'manager';

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    let isMounted = true;

    async function loadUsers() {
      setUsersError('');
      setIsUsersLoading(true);

      try {
        const filters = {};

        if (activeFilter !== 'all') {
          filters.active = activeFilter === 'active';
        }

        if (roleFilter !== 'all') {
          filters.role = roleFilter;
        }

        const response = await getUsers(filters);

        if (!isMounted) {
          return;
        }

        setUsers(response);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setUsersError(loadError.message || 'Unable to load users.');
      } finally {
        if (isMounted) {
          setIsUsersLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [canManageUsers, activeFilter, roleFilter]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!canManageUsers) {
      setError('You do not have permission to create users.');
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    };

    if (
      !payload.firstName ||
      !payload.lastName ||
      !payload.email ||
      !payload.password
    ) {
      setError('All fields are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const createdUser = await createUser(payload);
      setSuccessMessage(
        `Created user ${createdUser.firstName} ${createdUser.lastName}.`,
      );
      setForm(DEFAULT_FORM);
    } catch (submitError) {
      setError(submitError.message || 'Unable to create user.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h2>User Management</h2>

      {usersError ? <p role="alert">{usersError}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {successMessage ? <p role="status">{successMessage}</p> : null}

      {!canManageUsers ? (
        <p>Only managers and administrators can view organization users.</p>
      ) : null}

      {!canManageUsers ? (
        <p>Only managers and administrators can create users.</p>
      ) : null}

      {canManageUsers ? (
        <section aria-label="organization users">
          <h3>Organization Users</h3>

          <label htmlFor="active-filter">Active status</label>
          <select
            id="active-filter"
            name="activeFilter"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
            disabled={isUsersLoading}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <label htmlFor="role-filter">Role filter</label>
          <select
            id="role-filter"
            name="roleFilter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            disabled={isUsersLoading}
          >
            <option value="all">All roles</option>
            <option value="admin">Administrator</option>
            <option value="manager">Manager</option>
            <option value="rep">Representative</option>
          </select>

          {isUsersLoading ? <p>Loading users...</p> : null}

          {!isUsersLoading && users.length === 0 ? (
            <p>No users found for selected filters.</p>
          ) : null}

          {!isUsersLoading && users.length > 0 ? (
            <ul>
              {users.map((user) => (
                <li key={user.id}>
                  {user.firstName} {user.lastName} ({user.email}) - {user.role}{' '}
                  - {user.isActive ? 'Active' : 'Inactive'}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <form onSubmit={handleSubmit} aria-label="create user form">
        <label htmlFor="firstName">First name</label>
        <input
          id="firstName"
          name="firstName"
          type="text"
          value={form.firstName}
          onChange={handleChange}
          disabled={!canManageUsers || isSubmitting}
        />

        <label htmlFor="lastName">Last name</label>
        <input
          id="lastName"
          name="lastName"
          type="text"
          value={form.lastName}
          onChange={handleChange}
          disabled={!canManageUsers || isSubmitting}
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          disabled={!canManageUsers || isSubmitting}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          disabled={!canManageUsers || isSubmitting}
        />

        <label htmlFor="role">Role</label>
        <select
          id="role"
          name="role"
          value={form.role}
          onChange={handleChange}
          disabled={!canManageUsers || isSubmitting}
        >
          <option value="rep">Representative</option>
          <option value="manager">Manager</option>
          <option value="admin">Administrator</option>
        </select>

        <button type="submit" disabled={!canManageUsers || isSubmitting}>
          {isSubmitting ? 'Creating user...' : 'Create user'}
        </button>
      </form>
    </section>
  );
}
