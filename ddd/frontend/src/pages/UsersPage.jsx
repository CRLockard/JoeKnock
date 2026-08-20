import { useEffect, useState } from 'react';
import {
  createUser,
  getUsers,
  setUserActive,
  updateUser,
} from '../api/usersApi.js';
import { useAuth } from '../auth/useAuth.js';
import { SettingsWorkspace } from '../components/SettingsWorkspace.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';

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
    <SettingsWorkspace
      title="Users"
      description="Manage organization members, roles, and active status."
      activeSection="users"
    >
      {usersError ? (
        <p role="alert" className="feedback feedback--error">
          {usersError}
        </p>
      ) : null}
      {editError ? (
        <p role="alert" className="feedback feedback--error">
          {editError}
        </p>
      ) : null}
      {editSuccessMessage ? (
        <p role="status" className="feedback feedback--success">
          {editSuccessMessage}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="feedback feedback--error">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p role="status" className="feedback feedback--success">
          {successMessage}
        </p>
      ) : null}

      {!canManageUsers ? (
        <div className="panel">
          <p>Only managers and administrators can view organization users.</p>
        </div>
      ) : (
        <div className="workspace-grid workspace-grid--users">
          <section
            aria-label="organization users"
            className="panel panel--table"
          >
            <div className="panel__header panel__header--stacked">
              <div>
                <h3>Organization Users</h3>
                <p>Review active users, roles, and team-ready assignments.</p>
              </div>
            </div>

            <div className="filters-inline">
              <label
                className="form-field form-field--compact"
                htmlFor="active-filter"
              >
                <span>Active status</span>
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
              </label>

              <label
                className="form-field form-field--compact"
                htmlFor="role-filter"
              >
                <span>Role filter</span>
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
              </label>
            </div>

            {isUsersLoading ? (
              <p className="feedback">Loading users...</p>
            ) : null}

            {!isUsersLoading && users.length === 0 ? (
              <p className="feedback">No users found for selected filters.</p>
            ) : null}

            {!isUsersLoading && users.length > 0 ? (
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Email</th>
                      <th scope="col">Active</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{`${user.firstName} ${user.lastName}`}</strong>
                        </td>
                        <td>
                          <StatusBadge tone="info">{user.role}</StatusBadge>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <StatusBadge
                            tone={user.isActive ? 'success' : 'muted'}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="button button--ghost"
                              onClick={() => startEditingUser(user)}
                              disabled={
                                isEditSubmitting || isSetActiveSubmitting
                              }
                            >
                              Edit {user.firstName} {user.lastName}
                            </button>
                            {canSetActive ? (
                              <button
                                type="button"
                                className="button button--ghost"
                                onClick={() =>
                                  handleSetUserActive(user, !user.isActive)
                                }
                                disabled={
                                  isSetActiveSubmitting || isEditSubmitting
                                }
                              >
                                {isSetActiveSubmitting &&
                                setActiveUserId === user.id
                                  ? user.isActive
                                    ? 'Deactivating...'
                                    : 'Reactivating...'
                                  : user.isActive
                                    ? `Deactivate ${user.firstName} ${user.lastName}`
                                    : `Reactivate ${user.firstName} ${user.lastName}`}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <aside className="workspace-side-panel">
            <form
              onSubmit={handleSubmit}
              aria-label="create user form"
              className="panel stack-form"
            >
              <div className="panel__header">
                <h3>Add User</h3>
              </div>

              <label className="form-field" htmlFor="firstName">
                <span>First name</span>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={form.firstName}
                  onChange={handleChange}
                  disabled={!canManageUsers || isSubmitting}
                />
              </label>

              <label className="form-field" htmlFor="lastName">
                <span>Last name</span>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={form.lastName}
                  onChange={handleChange}
                  disabled={!canManageUsers || isSubmitting}
                />
              </label>

              <label className="form-field" htmlFor="email">
                <span>Email</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled={!canManageUsers || isSubmitting}
                />
              </label>

              <label className="form-field" htmlFor="password">
                <span>Password</span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  disabled={!canManageUsers || isSubmitting}
                />
              </label>

              <label className="form-field" htmlFor="role">
                <span>Role</span>
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
              </label>

              <button
                type="submit"
                className="button button--primary"
                disabled={!canManageUsers || isSubmitting}
              >
                {isSubmitting ? 'Creating user...' : 'Create user'}
              </button>
            </form>

            {editingUserId ? (
              <form
                onSubmit={handleEditSubmit}
                aria-label="edit user form"
                className="panel stack-form"
              >
                <div className="panel__header">
                  <h3>Edit User</h3>
                </div>

                <label className="form-field" htmlFor="edit-first-name">
                  <span>Edit first name</span>
                  <input
                    id="edit-first-name"
                    name="firstName"
                    type="text"
                    value={editForm.firstName}
                    onChange={handleEditChange}
                    disabled={isEditSubmitting}
                  />
                </label>

                <label className="form-field" htmlFor="edit-last-name">
                  <span>Edit last name</span>
                  <input
                    id="edit-last-name"
                    name="lastName"
                    type="text"
                    value={editForm.lastName}
                    onChange={handleEditChange}
                    disabled={isEditSubmitting}
                  />
                </label>

                <label className="form-field" htmlFor="edit-role">
                  <span>Edit role</span>
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
                </label>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={isEditSubmitting}
                  >
                    {isEditSubmitting ? 'Saving...' : 'Save user'}
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={stopEditingUser}
                    disabled={isEditSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </aside>
        </div>
      )}
    </SettingsWorkspace>
  );
}
