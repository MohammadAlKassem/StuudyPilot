import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function NotFoundPage() {
  const { isAuthenticated, user } = useAuth();
  const home = isAuthenticated
    ? user?.role === 'admin' ? '/admin' : '/dashboard'
    : '/login';

  return (
    <main className="status-page">
      <section className="status-card" aria-labelledby="not-found-title">
        <span className="status-card__icon" aria-hidden="true">
          <FileQuestion />
        </span>
        <p className="status-card__code">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p>The page you requested does not exist or may have moved.</p>
        <Link className="button button--primary" to={home}>
          {isAuthenticated ? 'Return to dashboard' : 'Go to sign in'}
        </Link>
      </section>
    </main>
  );
}

