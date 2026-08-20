import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout as logoutApi } from '../api/authApi.js';
import { useAuth } from '../auth/useAuth.js';

export function App() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const isAuthenticated = auth.isAuthenticated;
  const isMapRoute = location.pathname.startsWith('/map');

  const navigationItems = useMemo(() => {
    const items = [{ label: 'Map', to: '/map' }];

    if (auth.user?.role === 'manager' || auth.user?.role === 'admin') {
      items.push({ label: 'Reports', to: '/reports/activity' });
    }

    return items;
  }, [auth.user?.role]);

  const displayName = auth.user?.firstName
    ? `${auth.user.firstName} ${auth.user.lastName ?? ''}`.trim()
    : 'Account';

  useEffect(() => {
    setIsDrawerOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

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
    <div
      className={`app-shell${isAuthenticated ? ' app-shell--authenticated' : ''}${isMapRoute ? ' app-shell--map' : ''}`}
    >
      <header className="app-header">
        {isAuthenticated ? (
          <button
            type="button"
            className="app-header__icon-button"
            aria-label={
              isDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            aria-expanded={isDrawerOpen}
            onClick={() => setIsDrawerOpen((previous) => !previous)}
          >
            <span />
            <span />
            <span />
          </button>
        ) : null}

        <NavLink to={isAuthenticated ? '/map' : '/login'} className="app-brand">
          JoeKnock
        </NavLink>

        {isAuthenticated ? (
          <div className="app-header__actions">
            <button
              type="button"
              className="app-header__account-button"
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              onClick={() => setIsUserMenuOpen((previous) => !previous)}
            >
              <span>{displayName}</span>
              <span className="app-header__caret" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      {isAuthenticated && isDrawerOpen ? (
        <button
          type="button"
          className="app-shell__scrim"
          aria-label="Close navigation overlay"
          onClick={() => setIsDrawerOpen(false)}
        />
      ) : null}

      {isAuthenticated && isDrawerOpen ? (
        <aside
          className={`app-drawer${isDrawerOpen ? ' app-drawer--open' : ''}`}
          aria-label="Primary navigation"
        >
          <nav className="app-drawer__nav">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `app-drawer__link${isActive ? ' app-drawer__link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="app-drawer__footer">
            <strong>JoeKnock</strong>
            <span>v1.0.0</span>
          </div>
        </aside>
      ) : null}

      {isAuthenticated && isUserMenuOpen ? (
        <div className="app-user-menu" role="menu" aria-label="User menu">
          <NavLink
            to="/profile"
            className="app-user-menu__item"
            role="menuitem"
          >
            Profile
          </NavLink>
          <NavLink
            to="/settings?section=company"
            className="app-user-menu__item"
            role="menuitem"
          >
            Settings
          </NavLink>
          <button
            type="button"
            className="app-user-menu__item app-user-menu__item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      ) : null}

      <main className={`app-main${isMapRoute ? ' app-main--map' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
