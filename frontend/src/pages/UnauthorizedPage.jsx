import { ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const home = isAuthenticated
    ? user?.role === 'admin' ? '/admin' : '/dashboard'
    : '/login';

  return (
    <main className="status-page">
      <section className="status-card" aria-labelledby="unauthorized-title">
        <span className="status-card__icon status-card__icon--warning" aria-hidden="true">
          <ShieldAlert />
        </span>
        <p className="status-card__code">403</p>
        <h1 id="unauthorized-title">You do not have access to this page</h1>
        <p>
          Your StudyPilot account is signed in, but this area is assigned to a different role.
        </p>
        <div className="status-card__actions">
          <Link className="button button--primary" to={home}>Go to your dashboard</Link>
          <button className="button button--secondary" type="button" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </section>
    </main>
  );
}

