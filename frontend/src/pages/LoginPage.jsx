import { useState } from 'react';
import { BookOpenCheck, CheckCircle2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function destinationFor(role) {
  return role === 'admin' ? '/admin' : '/dashboard';
}

function validateLogin(values) {
  const errors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = 'Email is required.';
  } else if (email.length > 150 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.password) errors.password = 'Password is required.';
  return errors;
}

export default function LoginPage() {
  const { isAuthenticated, loading, login, refreshUser, restorationError, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({
    email: location.state?.registeredEmail || '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [retryingSession, setRetryingSession] = useState(false);

  if (loading) {
    return (
      <main className="auth-loading" aria-busy="true" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Restoring your StudyPilot session...</p>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={destinationFor(user.role)} replace />;
  }

  const statusMessage = location.state?.registrationSuccess || location.state?.message;

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setRequestError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validateLogin(values);
    setFieldErrors(errors);
    setRequestError('');

    if (Object.keys(errors).length) {
      const form = event.currentTarget;
      window.requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = await login({
        email: values.email.trim(),
        password: values.password,
      });
      navigate(destinationFor(currentUser.role), { replace: true });
    } catch (error) {
      setRequestError(error?.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <aside className="auth-showcase" aria-label="About StudyPilot">
        <div className="auth-brand auth-brand--light">
          <span className="auth-brand__mark" aria-hidden="true">
            <BookOpenCheck size={28} />
          </span>
          <span>StudyPilot</span>
        </div>

        <div className="auth-showcase__content">
          <span className="auth-eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            AI study planner
          </span>
          <h2>Turn your workload into a clear study plan.</h2>
          <p>
            Keep courses, deadlines, notes, and focused AI-generated plans together in one
            dependable workspace.
          </p>
          <ul className="auth-benefits">
            <li><CheckCircle2 aria-hidden="true" /> Organize every course and task</li>
            <li><CheckCircle2 aria-hidden="true" /> See progress at a glance</li>
            <li><CheckCircle2 aria-hidden="true" /> Build practical study sessions</li>
          </ul>
        </div>
      </aside>

      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-card">
          <div className="auth-brand auth-brand--mobile">
            <span className="auth-brand__mark" aria-hidden="true">
              <BookOpenCheck size={25} />
            </span>
            <span>StudyPilot</span>
          </div>

          <header className="auth-card__header">
            <p className="auth-kicker">Welcome back</p>
            <h1 id="login-title">Sign in to StudyPilot</h1>
            <p>Continue to your study workspace.</p>
          </header>

          {statusMessage ? (
            <div className="alert alert--success" role="status">
              <CheckCircle2 size={19} aria-hidden="true" />
              <span>{statusMessage}</span>
            </div>
          ) : null}

          {requestError ? (
            <div className="alert alert--error" role="alert">
              {requestError}
            </div>
          ) : null}

          {restorationError ? (
            <div className="alert alert--warning" role="alert">
              <span>{restorationError}</span>
              <button
                type="button"
                className="button button--secondary button--small"
                disabled={retryingSession}
                onClick={async () => {
                  setRetryingSession(true);
                  try {
                    await refreshUser();
                  } catch {
                    // AuthContext keeps the readable restoration error current.
                  } finally {
                    setRetryingSession(false);
                  }
                }}
              >
                {retryingSession ? 'Retrying…' : 'Retry saved session'}
              </button>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                autoComplete="email"
                inputMode="email"
                maxLength={150}
                required
                autoFocus
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              />
              {fieldErrors.email ? (
                <p className="field-error" id="login-email-error">{fieldErrors.email}</p>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="login-password">Password</label>
              <div className="password-input">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  maxLength={72}
                  required
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p className="field-error" id="login-password-error">{fieldErrors.password}</p>
              ) : null}
            </div>

            <button className="button button--primary button--full" type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            New to StudyPilot? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
