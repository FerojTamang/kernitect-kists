import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../features/auth/auth.context';
import type { NavigationItem } from '../types/navigation';

interface AppLayoutProps {
  audience: string;
  basePath: string;
  navigation: NavigationItem[];
}

export function AppLayout({ audience, basePath, navigation }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Unable to sign out. Please try again.',
      );
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <BrandLogo />
        <p className="nav-heading">{audience} workspace</p>
        <nav aria-label={`${audience} navigation`}>
          {navigation.map((item) => (
            <NavLink key={item.path} to={`${basePath}/${item.path}`} end>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>
            {user?.firstName} {user?.lastName}
          </span>
          <button
            className="button"
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Interactive Safety Training System</span>
          <span className="badge">{audience} preview</span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          Kernitect · Warehousing & logistics safety
        </footer>
      </div>
    </div>
  );
}
