import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../features/auth/auth.context';
import type { NavigationItem } from '../types/navigation';
import { DashboardIcon } from '../features/trainee/DashboardIcon';
import './admin-shell.css';

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

  if (label === 'Certificates') {
    return /^\/trainee\/certificates(?:\/\d+)?$/.test(pathname);
  }

  return false;
}

export function AppLayout({ audience, basePath, navigation }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isTrainee = audience === 'Trainee';
  const isCoursePlayer =
    isTrainee &&
    /^\/trainee\/training\/\d+(?:\/(?:scenario|assessment))?$/.test(
      location.pathname,
    );
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const adminSectionLabelRaw = !isTrainee
    ? navigation.find((item) =>
        location.pathname.startsWith(`${basePath}/${item.path}`),
      )?.label ?? 'Dashboard'
    : '';
  const adminSectionLabel =
    adminSectionLabelRaw === 'Training content'
      ? 'Training Content'
      : adminSectionLabelRaw;

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

  if (isCoursePlayer) {
    const isScenarioPlayer = location.pathname.endsWith('/scenario');
    const isAssessmentPlayer = location.pathname.endsWith('/assessment');
    return (
      <div
        className={
          isScenarioPlayer
            ? 'scenario-route-shell'
            : isAssessmentPlayer
              ? 'assessment-route-shell'
              : 'course-route-shell'
        }
      >
        <a className="skip-link" href="#main-content">
          {isScenarioPlayer
            ? 'Skip to scenario'
            : isAssessmentPlayer
              ? 'Skip to assessment'
              : 'Skip to lesson content'}
        </a>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    );
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
          <div className="dashboard-logo-frame">
            <BrandLogo variant="transparent-white" />
          </div>
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
                <DashboardIcon name={label} />
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
          {isTrainee ? (
            <span>Interactive Safety Training System</span>
          ) : (
            <nav className="admin-shell-breadcrumb" aria-label="Breadcrumb">
              <span>KISTS Administration</span>
              <span aria-hidden="true">›</span>
              <strong>{adminSectionLabel}</strong>
            </nav>
          )}
          {isTrainee ? (
            <span className="badge">{audience} preview</span>
          ) : (
            <Link className="admin-shell-profile" to="/admin/settings" aria-label="Open administrator settings">
              <span className="admin-shell-avatar" aria-hidden="true">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : `${user?.firstName[0] ?? ''}${user?.lastName[0] ?? ''}`.toUpperCase()}
              </span>
              <span><strong>{user ? `${user.firstName} ${user.lastName}`.trim() : 'KISTS Administrator'}</strong><small>Administrator</small></span>
            </Link>
          )}
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
