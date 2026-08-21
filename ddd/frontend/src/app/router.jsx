import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { MapPage } from '../pages/MapPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { SettingsPage } from '../pages/SettingsPage.jsx';
import { UsersPage } from '../pages/UsersPage.jsx';
import { ActivityReportPage } from '../pages/ActivityReportPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // Keep '/' as a compatibility entrypoint and redirect to the canonical
      // authenticated landing page. This avoids duplicating home/dashboard UI.
      { index: true, element: <Navigate to="/map" replace /> },
      { path: 'login', element: <LoginPage /> },
      // ProtectedRoute is a client-navigation guard. Server-side auth remains
      // authoritative for every API request behind these screens.
      {
        path: 'map',
        element: (
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings/users',
        element: (
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/activity',
        element: (
          <ProtectedRoute>
            <ActivityReportPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
