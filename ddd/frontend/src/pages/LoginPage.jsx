import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/authApi.js';
import { useAuth } from '../auth/useAuth.js';

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await login({
        email,
        password,
      });

      auth.setSession({
        token: result.token,
        user: result.user,
      });

      navigate('/map', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h2>Login</h2>
      <form onSubmit={handleSubmit} aria-label="login form">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error ? <p role="alert">{error}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}
