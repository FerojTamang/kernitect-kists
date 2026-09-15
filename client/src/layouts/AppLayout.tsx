import { Link, NavLink, Outlet } from 'react-router-dom';
import { Brand } from '../components/Brand';
import type { NavigationItem } from '../types/navigation';

interface AppLayoutProps {
  audience: string;
  basePath: string;
  navigation: NavigationItem[];
}

export function AppLayout({ audience, basePath, navigation }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <p className="nav-heading">{audience} workspace</p>
        <nav aria-label={`${audience} navigation`}>
          {navigation.map((item) => (
            <NavLink key={item.path} to={`${basePath}/${item.path}`} end>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>Phase 1 · Foundation</span>
          <Link to="/">Switch workspace</Link>
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
