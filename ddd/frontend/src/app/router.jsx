import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { MapPage } from '../pages/MapPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/map" replace /> },
      { path: 'login', element: <LoginPage /> },
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
    ],
  },
]);
