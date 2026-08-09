import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function RoleLoading() {
  return (
    <main className="route-loading" aria-busy="true" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <p>Checking access...</p>
    </main>
  );
}

export default function RoleRoute({ allowedRoles, allowedRole, roles, role, children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RoleLoading />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const configuredRoles = allowedRoles ?? roles ?? allowedRole ?? role;
  const allowed = Array.isArray(configuredRoles)
    ? configuredRoles
    : [configuredRoles].filter(Boolean);

  if (allowed.includes(user.role)) {
    return children ?? <Outlet />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/unauthorized" replace />;
}
