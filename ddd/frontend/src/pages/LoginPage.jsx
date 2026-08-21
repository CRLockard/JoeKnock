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
      // Login returns the canonical session payload used by AuthProvider and
      // persisted storage: bearer token plus normalized public user context.
      const result = await login({
        email,
        password,
      });

      auth.setSession({
        token: result.token,
        user: result.user,
      });

      // Successful authentication always lands on map-first workflow.
      navigate('/map', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <div className="login-card__brand">
          <div>
            <h2>JoeKnock</h2>
            <p className="login-card__tagline">Knock. Click. Go.</p>
            <p className="login-card__supporting-copy">
              Field interaction made simple.
            </p>
          </div>
          <div className="login-card__illustration" aria-hidden="true">
            <div className="login-card__house" />
            <div className="login-card__pin" />
          </div>
        </div>

        <div className="login-card__form-panel">
          <div className="page-header page-header--compact">
            <div>
              <p className="page-header__eyebrow">Welcome Back</p>
              <h2>Login</h2>
              <p className="page-header__description">
                Sign in to your account.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-label="login form"
            className="stack-form"
          >
            <label className="form-field" htmlFor="email">
              <span>Email</span>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="form-field" htmlFor="password">
              <span>Password</span>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error ? (
              <p role="alert" className="feedback feedback--error">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="button button--primary button--full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
