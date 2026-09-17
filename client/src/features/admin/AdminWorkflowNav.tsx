import { Link, useLocation } from 'react-router-dom';
import './admin-workflow-nav.css';

const workflowSteps = [
  {
    to: '/admin/dashboard',
    step: '01',
    label: 'Dashboard',
    linkLabel: 'Open administrator dashboard',
    detail: 'Overview',
  },
  {
    to: '/admin/users',
    step: '02',
    label: 'Users',
    linkLabel: 'Open users & job roles',
    detail: 'Trainees & roles',
  },
  {
    to: '/admin/assignments',
    step: '03',
    label: 'Assignments',
    linkLabel: 'Open training assignments',
    detail: 'Allocate training',
  },
  {
    to: '/admin/progress',
    step: '04',
    label: 'Progress',
    linkLabel: 'Open progress monitoring',
    detail: 'Results & certificates',
  },
] as const;

export function AdminWorkflowNav() {
  const { pathname } = useLocation();

  return (
    <nav className="admin-workflow-nav" aria-label="Administrator workflow">
      <div className="admin-workflow-heading">
        <span>Administrator workflow</span>
        <small>Manage trainees from account setup through training results.</small>
      </div>
      <ol>
        {workflowSteps.map((item) => {
          const current = pathname === item.to;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-label={item.linkLabel}
                aria-current={current ? 'page' : undefined}
                className={current ? 'is-current' : undefined}
              >
                <span className="admin-workflow-step" aria-hidden="true">
                  {item.step}
                </span>
                <span className="admin-workflow-copy">
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="admin-workflow-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
