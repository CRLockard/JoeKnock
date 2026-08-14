import { useState } from 'react';
import { createUser } from '../api/usersApi.js';
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
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreateUsers =
    auth.user?.role === 'admin' || auth.user?.role === 'manager';

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

    if (!canCreateUsers) {
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

      {error ? <p role="alert">{error}</p> : null}
      {successMessage ? <p role="status">{successMessage}</p> : null}

      {!canCreateUsers ? (
        <p>Only managers and administrators can create users.</p>
      ) : null}

      <form onSubmit={handleSubmit} aria-label="create user form">
        <label htmlFor="firstName">First name</label>
        <input
          id="firstName"
          name="firstName"
          type="text"
          value={form.firstName}
          onChange={handleChange}
          disabled={!canCreateUsers || isSubmitting}
        />

        <label htmlFor="lastName">Last name</label>
        <input
          id="lastName"
          name="lastName"
          type="text"
          value={form.lastName}
          onChange={handleChange}
          disabled={!canCreateUsers || isSubmitting}
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          disabled={!canCreateUsers || isSubmitting}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          disabled={!canCreateUsers || isSubmitting}
        />

        <label htmlFor="role">Role</label>
        <select
          id="role"
          name="role"
          value={form.role}
          onChange={handleChange}
          disabled={!canCreateUsers || isSubmitting}
        >
          <option value="rep">Representative</option>
          <option value="manager">Manager</option>
          <option value="admin">Administrator</option>
        </select>

        <button type="submit" disabled={!canCreateUsers || isSubmitting}>
          {isSubmitting ? 'Creating user...' : 'Create user'}
        </button>
      </form>
    </section>
  );
}
