import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth.context';
import { workspaceFor, type SystemRole } from './auth.types';

export function ProtectedRoute({ role }: { role: SystemRole }) {
  const { user, loading, connectionError, refresh } = useAuth();
  if (loading)
    return (
      <main className="auth-status" role="status">
        Checking your session…
      </main>
    );
  if (connectionError)
    return (
      <main className="auth-status">
        <h1>Unable to check your session</h1>
        <p role="alert">{connectionError}</p>
        <button className="button" onClick={() => void refresh()}>
          Try again
        </button>
      </main>
    );
  if (!user) return <Navigate to="/" replace />;
  if (user.systemRole !== role)
    return (
      <main className="auth-status">
        <h1>Access denied</h1>
        <p>You do not have access to this workspace.</p>
        <Link to={workspaceFor(user.systemRole)}>Return to your workspace</Link>
      </main>
    );
  return <Outlet />;
}
