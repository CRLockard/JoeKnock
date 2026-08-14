import { useEffect, useState } from 'react';
import {
  createUser,
  getUsers,
  setUserActive,
  updateUser,
} from '../api/usersApi.js';
import { useAuth } from '../auth/useAuth.js';

const DEFAULT_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'rep',
};

const DEFAULT_EDIT_FORM = {
  firstName: '',
  lastName: '',
  role: 'rep',
};

export function UsersPage() {
  const auth = useAuth();
  const [users, setUsers] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [editingUserId, setEditingUserId] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccessMessage, setEditSuccessMessage] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isSetActiveSubmitting, setIsSetActiveSubmitting] = useState(false);
  const [setActiveUserId, setSetActiveUserId] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageUsers =
    auth.user?.role === 'admin' || auth.user?.role === 'manager';
  const canSetActive = auth.user?.role === 'admin';

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

  function startEditingUser(user) {
    setEditingUserId(user.id);
    setEditError('');
    setEditSuccessMessage('');
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  }

  function stopEditingUser() {
    setEditingUserId('');
    setEditError('');
    setEditForm(DEFAULT_EDIT_FORM);
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    setEditError('');
    setEditSuccessMessage('');

    if (!canManageUsers) {
      setEditError('You do not have permission to update users.');
      return;
    }

    if (!editingUserId) {
      setEditError('No user selected for update.');
      return;
    }

    const payload = {
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      role: editForm.role,
    };

    if (!payload.firstName || !payload.lastName) {
      setEditError('First name and last name are required for update.');
      return;
    }

    setIsEditSubmitting(true);

    try {
      const updated = await updateUser(editingUserId, payload);
      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user.id === updated.id
            ? {
                ...user,
                ...updated,
              }
            : user,
        ),
      );
      setEditSuccessMessage(
        `Updated user ${updated.firstName} ${updated.lastName}.`,
      );
      setEditingUserId('');
      setEditForm(DEFAULT_EDIT_FORM);
    } catch (submitError) {
      setEditError(submitError.message || 'Unable to update user.');
    } finally {
      setIsEditSubmitting(false);
    }
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

  async function handleSetUserActive(user, isActive) {
    setEditError('');
    setEditSuccessMessage('');

    if (!canSetActive) {
      setEditError('Only administrators can change user active status.');
      return;
    }

    setIsSetActiveSubmitting(true);
    setSetActiveUserId(user.id);

    try {
      const updated = await setUserActive(user.id, isActive);
      setUsers((previousUsers) =>
        previousUsers.map((currentUser) =>
          currentUser.id === updated.id
            ? {
                ...currentUser,
                ...updated,
              }
            : currentUser,
        ),
      );
      setEditSuccessMessage(
        `${updated.firstName} ${updated.lastName} is now ${
          updated.isActive ? 'active' : 'inactive'
        }.`,
      );
    } catch (submitError) {
      setEditError(
        submitError.message || 'Unable to update user active status.',
      );
    } finally {
      setIsSetActiveSubmitting(false);
      setSetActiveUserId('');
    }
  }

  return (
    <section>
      <h2>User Management</h2>

      {usersError ? <p role="alert">{usersError}</p> : null}
      {editError ? <p role="alert">{editError}</p> : null}
      {editSuccessMessage ? <p role="status">{editSuccessMessage}</p> : null}
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
                  <button
                    type="button"
                    onClick={() => startEditingUser(user)}
                    disabled={isEditSubmitting || isSetActiveSubmitting}
                  >
                    Edit {user.firstName} {user.lastName}
                  </button>
                  {canSetActive ? (
                    <button
                      type="button"
                      onClick={() => handleSetUserActive(user, !user.isActive)}
                      disabled={isSetActiveSubmitting || isEditSubmitting}
                    >
                      {isSetActiveSubmitting && setActiveUserId === user.id
                        ? user.isActive
                          ? 'Deactivating...'
                          : 'Reactivating...'
                        : user.isActive
                          ? `Deactivate ${user.firstName} ${user.lastName}`
                          : `Reactivate ${user.firstName} ${user.lastName}`}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {editingUserId ? (
            <form onSubmit={handleEditSubmit} aria-label="edit user form">
              <h4>Edit User</h4>

              <label htmlFor="edit-first-name">Edit first name</label>
              <input
                id="edit-first-name"
                name="firstName"
                type="text"
                value={editForm.firstName}
                onChange={handleEditChange}
                disabled={isEditSubmitting}
              />

              <label htmlFor="edit-last-name">Edit last name</label>
              <input
                id="edit-last-name"
                name="lastName"
                type="text"
                value={editForm.lastName}
                onChange={handleEditChange}
                disabled={isEditSubmitting}
              />

              <label htmlFor="edit-role">Edit role</label>
              <select
                id="edit-role"
                name="role"
                value={editForm.role}
                onChange={handleEditChange}
                disabled={isEditSubmitting}
              >
                <option value="rep">Representative</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>

              <button type="submit" disabled={isEditSubmitting}>
                {isEditSubmitting ? 'Saving...' : 'Save user'}
              </button>

              <button
                type="button"
                onClick={stopEditingUser}
                disabled={isEditSubmitting}
              >
                Cancel
              </button>
            </form>
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
