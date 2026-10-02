import { Link, useLocation } from 'react-router-dom';
import { DashboardIcon } from '../trainee/DashboardIcon';
import './admin-workflow-nav.css';

const workflowSteps = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    linkLabel: 'Open administrator dashboard',
    detail: 'Overview',
  },
  {
    to: '/admin/users',
    label: 'Users',
    linkLabel: 'Open users & job roles',
    detail: 'Trainees & roles',
  },
  {
    to: '/admin/assignments',
    label: 'Assignments',
    linkLabel: 'Open training assignments',
    detail: 'Allocate training',
  },
  {
    to: '/admin/progress',
    label: 'Progress',
    linkLabel: 'Open progress monitoring',
    detail: 'Results & certificates',
  },
] as const;

export function AdminWorkflowNav({
  dashboard = false,
}: { dashboard?: boolean } = {}) {
  const { pathname } = useLocation();
  const steps = dashboard
    ? [
        workflowSteps[1],
        workflowSteps[2],
        { ...workflowSteps[3], label: 'Progress & results' },
        {
          to: '/admin/training',
          label: 'Training content',
          linkLabel: 'Open training content',
          detail: 'Modules & assessments',
        },
      ]
    : workflowSteps;

  return (
    <nav className="admin-workflow-nav" aria-label="Administrator workflow">
      <div className="admin-workflow-heading">
        <span>
          {dashboard ? 'Quick actions' : 'Quick management shortcuts'}
        </span>
        <small>Open the administrator tools you use most.</small>
      </div>
      <ol>
        {steps.map((item) => {
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
                  <DashboardIcon
                    name={
                      item.label === 'Progress'
                        ? 'Progress & results'
                        : item.label
                    }
                  />
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
