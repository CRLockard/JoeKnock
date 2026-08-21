import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';

export function ProtectedRoute({ children }) {
  const auth = useAuth();
  const location = useLocation();

  // This is a client UX gate. Backend route authorization remains the
  // security boundary because API calls can bypass frontend routing.
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
