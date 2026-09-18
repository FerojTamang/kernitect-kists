import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../features/auth/auth.context';
import type { NavigationItem } from '../types/navigation';
import { DashboardIcon } from '../features/trainee/DashboardIcon';

interface AppLayoutProps {
  audience: string;
  basePath: string;
  navigation: NavigationItem[];
}

const sidebarItems = [
  'Dashboard',
  'My Training',
  'Scenarios',
  'Assessments',
  'Certificates',
  'Progress',
  'Resources',
  'Settings',
];

function traineeSectionIsActive(label: string, pathname: string): boolean {
  if (label === 'My Training') {
    return (
      pathname === '/trainee/training' ||
      /^\/trainee\/training\/\d+$/.test(pathname)
    );
  }

  if (label === 'Scenarios') {
    return (
      pathname === '/trainee/scenarios' ||
      /^\/trainee\/training\/\d+\/scenario$/.test(pathname)
    );
  }

  if (label === 'Assessments') {
    return (
      pathname === '/trainee/assessments' ||
      /^\/trainee\/training\/\d+\/assessment$/.test(pathname)
    );
  }

  return false;
}

function navigationIcon(label: string): string {
  const icons: Record<string, string> = {
    Dashboard: '▣',
    'My Training': '◫',
    Scenarios: '◧',
    Assessments: '▤',
    Certificates: '◨',
    Progress: '▥',
    Resources: '◫',
    Settings: '⚙',
    Users: '◉',
    'Training content': '◫',
    Assignments: '▤',
    'Progress & results': '▥',
  };

  return icons[label] ?? '•';
}

export function AppLayout({ audience, basePath, navigation }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isTrainee = audience === 'Trainee';
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const items =
    audience === 'Trainee'
      ? sidebarItems.map((label, index) => {
          const pathMap: Record<number, string> = {
            0: 'dashboard',
            1: 'training',
            2: 'scenarios',
            3: 'assessments',
            4: 'certificates',
            5: 'progress',
            6: 'resources',
            7: 'settings',
          };

          return {
            label,
            to: `${basePath}/${pathMap[index]}`,
            active: traineeSectionIsActive(label, location.pathname),
          };
        })
      : navigation.map((item) => ({
          label: item.label,
          to: `${basePath}/${item.path}`,
          active: false,
        }));

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
    <div
      className={`app-shell ${audience.toLowerCase()}-shell${isTrainee ? ' trainee-dashboard-shell' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="sidebar">
        <div className="brand-block">
          {isTrainee ? (
            <div className="dashboard-logo-frame">
              <BrandLogo variant="dark" />
            </div>
          ) : (
            <BrandLogo variant="dark" />
          )}
          <div className="brand-tagline">PEOPLE | SAFETY | PROGRESS</div>
          <div className="brand-copy">
            <div className="brand-name">KISTS</div>
            <div className="brand-subtitle">
              Kernitect Interactive
              <br />
              Safety Training System
            </div>
            <span className="brand-divider" aria-hidden="true" />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={`${audience} navigation`}>
          {items.map(({ label, to, active }) => (
            <NavLink
              key={label}
              to={to}
              end={audience === 'Trainee' || label === 'Dashboard'}
              className={({ isActive }) =>
                `nav-item ${isActive || active ? 'active' : ''}`
              }
            >
              <span className="nav-icon" aria-hidden="true">
                {isTrainee ? (
                  <DashboardIcon name={label} />
                ) : (
                  navigationIcon(label)
                )}
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-message">
            Safer People.
            <br />
            Stronger Workplaces.
          </span>

          <div className="sidebar-user">
            <span>
              {user?.firstName} {user?.lastName}
            </span>
            <button
              className="button sidebar-signout"
              onClick={() => void signOut()}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
            {logoutError && <p role="alert">{logoutError}</p>}
          </div>
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
