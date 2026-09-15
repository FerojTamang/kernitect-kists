import { Link } from 'react-router-dom';
import { Brand } from '../../components/Brand';

export function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-intro">
        <Brand />
        <div>
          <p className="eyebrow">Learn safely. Work confidently.</p>
          <h1>Safer warehouses start with better training.</h1>
          <p>
            Kernitect Interactive Safety Training System supports safety
            learning for warehousing and logistics teams.
          </p>
        </div>
        <span>Phase 1 · Project foundation</span>
      </section>
      <section className="login-content">
        <div className="login-card">
          <span className="badge">Workspace preview</span>
          <h2>Welcome to KISTS</h2>
          <p>
            This is the login placeholder. Authentication is not implemented
            yet. Explore the page structure using the links below.
          </p>
          <Link className="button" to="/trainee/dashboard">
            Explore trainee workspace <span aria-hidden="true">→</span>
          </Link>
          <Link className="button secondary" to="/admin/dashboard">
            Explore administrator workspace <span aria-hidden="true">→</span>
          </Link>
          <p className="small-note">
            Preview links do not sign you in. Both workspaces are publicly
            accessible in this foundation.
          </p>
        </div>
      </section>
    </main>
  );
}
