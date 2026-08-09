import { useState } from 'react';
import { BookOpenCheck, CheckCircle2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function destinationFor(role) {
  return role === 'admin' ? '/admin' : '/dashboard';
}

function validateRegistration(values) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();

  if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  } else if (name.length > 100) {
    errors.name = 'Name must not exceed 100 characters.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (email.length > 150 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (values.password.length < 6 || values.password.length > 72) {
    errors.password = 'Password must be between 6 and 72 characters.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export default function RegisterPage() {
  const { isAuthenticated, loading, register, user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setRequestError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validateRegistration(values);
    setFieldErrors(errors);
    setRequestError('');

    if (Object.keys(errors).length) {
      const form = event.currentTarget;
      window.requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    setSubmitting(true);
    try {
      const result = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });

      if (result.token && result.user) {
        navigate(destinationFor(result.user.role), { replace: true });
        return;
      }

      navigate('/login', {
        replace: true,
        state: {
          registrationSuccess: 'Your account was created. Sign in to continue.',
          registeredEmail: values.email.trim(),
        },
      });
    } catch (error) {
      setRequestError(error?.message || 'Unable to create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <aside className="auth-showcase auth-showcase--register" aria-label="About StudyPilot">
        <div className="auth-brand auth-brand--light">
          <span className="auth-brand__mark" aria-hidden="true">
            <BookOpenCheck size={28} />
          </span>
          <span>StudyPilot</span>
        </div>

        <div className="auth-showcase__content">
          <span className="auth-eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            Study with direction
          </span>
          <h2>Build better study habits from day one.</h2>
          <p>
            Create a focused space for your university courses, everyday notes, deadlines,
            and personalized plans.
          </p>
          <ul className="auth-benefits">
            <li><CheckCircle2 aria-hidden="true" /> Track work by course</li>
            <li><CheckCircle2 aria-hidden="true" /> Stay ahead of deadlines</li>
            <li><CheckCircle2 aria-hidden="true" /> Save every generated plan</li>
          </ul>
        </div>
      </aside>

      <section className="auth-panel" aria-labelledby="register-title">
        <div className="auth-card auth-card--wide">
          <div className="auth-brand auth-brand--mobile">
            <span className="auth-brand__mark" aria-hidden="true">
              <BookOpenCheck size={25} />
            </span>
            <span>StudyPilot</span>
          </div>

          <header className="auth-card__header">
            <p className="auth-kicker">Student registration</p>
            <h1 id="register-title">Create your account</h1>
            <p>Start organizing your semester in a few moments.</p>
          </header>

          {requestError ? (
            <div className="alert alert--error" role="alert">{requestError}</div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                name="name"
                type="text"
                value={values.name}
                onChange={handleChange}
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                autoFocus
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
              />
              {fieldErrors.name ? (
                <p className="field-error" id="register-name-error">{fieldErrors.name}</p>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                autoComplete="email"
                inputMode="email"
                maxLength={150}
                required
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
              />
              {fieldErrors.email ? (
                <p className="field-error" id="register-email-error">{fieldErrors.email}</p>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="register-password">Password</label>
              <div className="password-input">
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={72}
                  required
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'register-password-error' : 'password-help'}
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
                <p className="field-error" id="register-password-error">{fieldErrors.password}</p>
              ) : (
                <p className="field-hint" id="password-help">Use 6 to 72 characters.</p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="register-confirm-password">Confirm password</label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={values.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                maxLength={72}
                required
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={
                  fieldErrors.confirmPassword ? 'register-confirm-password-error' : undefined
                }
              />
              {fieldErrors.confirmPassword ? (
                <p className="field-error" id="register-confirm-password-error">
                  {fieldErrors.confirmPassword}
                </p>
              ) : null}
            </div>

            <button className="button button--primary button--full" type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
