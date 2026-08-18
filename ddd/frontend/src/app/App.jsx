import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { logout as logoutApi } from '../api/authApi.js';
import { useAuth } from '../auth/useAuth.js';

export function App() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logoutApi();
    } catch {
      // A failed network call must not keep a client session active.
      // Local auth state is still cleared in finally.
    } finally {
      // Always clear local auth state. In a stateless JWT model, client storage
      // is the session boundary and must be removed even if the request fails.
      auth.logout();
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>JoeKnock Foundation</h1>
        {auth.isAuthenticated ? (
          <>
            <Link to="/settings">Settings</Link>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : null}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
