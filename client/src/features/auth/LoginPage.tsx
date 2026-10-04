import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import warehouseWorker from '../../assets/images/login-worker-warehouse.jpg';
import { useAuth } from './auth.context';
import { workspaceFor } from './auth.types';
import { LoginIcon } from './LoginIcon';
import './login.css';

export function LoginPage() {
  const { user, loading, login, sessionNotice, connectionError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [failure, setFailure] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (user && !loading)
    return <Navigate to={workspaceFor(user.systemRole)} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || loading) return;
    const nextErrors = {
      email: !email.trim()
        ? 'Enter your email address.'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
          ? 'Enter a valid email address.'
          : undefined,
      password: !password
        ? 'Enter your password.'
        : new TextEncoder().encode(password).length > 72
          ? 'Password must not exceed 72 UTF-8 bytes.'
          : undefined,
    };
    setErrors(nextErrors);
    setFailure(null);
    if (nextErrors.email || nextErrors.password) {
      (nextErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const authenticated = await login({ email, password, rememberMe });
      setPassword('');
      navigate(workspaceFor(authenticated.systemRole), { replace: true });
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'Sign-in failed. Please try again.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <a className="skip-link" href="#email">
        Skip to sign in
      </a>
      <section className="login-brand-panel" aria-label="About KISTS">
        <div className="login-brand-copy">
          <div className="login-logo-lockup">
            <div className="login-logo-frame">
              <BrandLogo />
            </div>
            <p className="login-logo-tagline">PEOPLE | SAFETY | PROGRESS</p>
          </div>
          <div className="login-brand-title">
            <h2>KISTS</h2>
            <p>
              Kernitect Interactive
              <br />
              Safety Training System
            </p>
          </div>
          <ul className="login-benefits">
            <li>
              <LoginIcon name="book" />
              <span>Interactive Learning</span>
            </li>
            <li>
              <LoginIcon name="box" />
              <span>Real-World Scenarios</span>
            </li>
            <li>
              <LoginIcon name="shield" />
              <span>Safer Workplaces</span>
            </li>
            <li>
              <LoginIcon name="chart" />
              <span>Measurable Progress</span>
            </li>
          </ul>
          <p className="login-brand-message">
            Safer People.
            <br />
            Stronger Workplaces.
          </p>
        </div>
        <div className="login-warehouse">
          <img className="warehouse-photo" src={warehouseWorker} alt="" />
          <div className="warehouse-caption">
            <p>
              “A safer tomorrow,
              <br />
              together.”
            </p>
            <span className="purple-rule" aria-hidden="true" />
          </div>
        </div>
      </section>
      <section className="login-form-area" aria-labelledby="login-heading">
        <div className="login-form-card">
          <p className="login-eyebrow">Welcome back</p>
          <h1 id="login-heading">Sign in to your training portal</h1>
          <p className="login-description">
            Access your assigned training, track your progress
            <br className="login-description-break" /> and help build a safer
            workplace.
          </p>
          {sessionNotice && (
            <p className="session-notice" role="status">
              {sessionNotice}
            </p>
          )}
          {(failure || connectionError) && (
            <p className="login-error-summary" role="alert">
              {failure || connectionError}
            </p>
          )}
          <form noValidate onSubmit={submit} aria-busy={submitting || loading}>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <div className="login-input-wrap">
                <LoginIcon name="email" />
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  value={email}
                  placeholder="Enter your email"
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  disabled={submitting}
                  required
                />
              </div>
              {errors.email && (
                <p id="email-error" className="field-error">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-input-wrap">
                <LoginIcon name="lock" />
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  placeholder="Enter your password"
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? 'password-error' : undefined
                  }
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  <LoginIcon name={visible ? 'eye-off' : 'eye'} />
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="field-error">
                  {errors.password}
                </p>
              )}
            </div>
            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={submitting}
                />
                Remember me on this device
                <span className="sr-only"> for 30 days</span>
              </label>
              <span
                className="forgot-password"
                title="Password reset is not yet available"
              >
                Forgot password?
              </span>
            </div>
            <button
              className="sign-in-button"
              type="submit"
              disabled={submitting || loading}
            >
              {loading
                ? 'Checking session…'
                : submitting
                  ? 'Signing in…'
                  : 'Sign In'}
              {!loading && !submitting && <LoginIcon name="arrow" />}
            </button>
          </form>
          <div className="login-divider" aria-hidden="true">
            or
          </div>
          <div className="login-access-note">
            <LoginIcon name="info" />
            <div>
              <strong>Need access?</strong>
              <p>Contact your administrator to request an account.</p>
              <a href="mailto:?subject=KISTS%20account%20access">
                Contact Administrator
              </a>
            </div>
          </div>
        </div>
        <footer className="login-footer">
          <span>
            © {new Date().getFullYear()} Kernitect. All rights reserved.
          </span>
          <ul className="login-footer-items" aria-label="Information">
            <li>
              <span title="Privacy information is not yet available">
                Privacy
              </span>
            </li>
            <li>
              <span title="Terms are not yet available">Terms</span>
            </li>
            <li>
              <span title="Contact your administrator for support">
                Support
              </span>
            </li>
          </ul>
        </footer>
      </section>
    </main>
  );
}
