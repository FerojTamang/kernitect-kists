import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, ApiError } from '../../services/api/request';
import { AdminWorkflowNav } from './AdminWorkflowNav';
import { DashboardIcon } from '../trainee/DashboardIcon';
import './admin-dashboard.css';

interface AdminDashboardData {
  administrator: {
    firstName: string;
    lastName: string;
    email: string;
  };
  summary: {
    totalTrainees: number;
    activeTrainees: number;
    activeAssignments: number;
    completedAssignments: number;
    certificatesIssued: number;
    completionRate: number;
  };
  trainees: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    jobRole: string | null;
    isActive: boolean;
    assignedCount: number;
    completedCount: number;
    progressPercentage: number;
    latestAssessmentScore: number | null;
    latestAssessmentPassed: boolean | null;
    certificateIssued: boolean;
  }>;
  modules: Array<{
    id: number;
    title: string;
    slug: string;
    assignedCount: number;
    completedCount: number;
    averageProgress: number;
  }>;
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  to,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  to: string;
}) {
  return (
    <Link className="admin-summary-card" to={to}>
      <span className="admin-summary-icon" aria-hidden="true">
        <DashboardIcon name={icon} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </Link>
  );
}

function DashboardState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="admin-dashboard">
      <section className="admin-state-card">
        <span className="admin-state-icon" aria-hidden="true">
          ◫
        </span>
        <h1>{title}</h1>
        <p>{detail}</p>
        {onRetry ? (
          <button
            className="admin-primary-button"
            type="button"
            onClick={onRetry}
          >
            Try again <span aria-hidden="true">↻</span>
          </button>
        ) : null}
      </section>
    </div>
  );
}

function traineeStatus(
  assignedCount: number,
  completedCount: number,
  progressPercentage: number,
) {
  if (assignedCount > 0 && completedCount === assignedCount) return 'Complete';
  if (progressPercentage > 0) return 'In progress';
  return 'Not started';
}

export function AdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      setDashboard(await apiRequest<AdminDashboardData>('/admin/dashboard'));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        return;
      }

      setError(
        'We could not load the administrator dashboard. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <DashboardState
        title="Loading administrator dashboard"
        detail="Preparing the latest workforce training information…"
      />
    );
  }

  if (error) {
    return (
      <DashboardState
        title="Administrator dashboard unavailable"
        detail={error}
        onRetry={() => void loadDashboard()}
      />
    );
  }

  if (!dashboard) return null;

  const { summary, trainees, modules } = dashboard;
  const outstandingAssignments = Math.max(
    summary.activeAssignments - summary.completedAssignments,
    0,
  );

  return (
    <div className="admin-dashboard">
      <div className="admin-top-row">
        <div>
          <p className="admin-context-label">Management workspace</p>
          <span className="admin-context-value">KISTS Administrator</span>
        </div>

      </div>

      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Workforce safety training</p>
          <h1>Administrator dashboard</h1>
          <p>
            Monitor trainee activity, training completion, assessment outcomes
            and certification from one workspace.
          </p>
        </div>

        <div className="admin-hero-status" aria-label="Overall completion rate">
          <span>Overall completion</span>
          <strong>{summary.completionRate}%</strong>
          <div
            className="admin-progress-track"
            role="progressbar"
            aria-label="Overall training completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.completionRate}
          >
            <span style={{ width: `${summary.completionRate}%` }} />
          </div>
          <small>
            {outstandingAssignments} active assignment
            {outstandingAssignments === 1 ? '' : 's'} still outstanding
          </small>
        </div>
      </section>

      <AdminWorkflowNav />

      <section
        className="admin-summary-grid"
        aria-label="Administrator training summary"
      >
        <SummaryCard
          label="Total trainees"
          value={summary.totalTrainees}
          detail={`${summary.activeTrainees} active accounts`}
          icon="Users"
          to="/admin/users"
        />
        <SummaryCard
          label="Active assignments"
          value={summary.activeAssignments}
          detail={`${outstandingAssignments} outstanding`}
          icon="Assignments"
          to="/admin/assignments"
        />
        <SummaryCard
          label="Completed training"
          value={summary.completedAssignments}
          detail={`${summary.completionRate}% completion rate`}
          icon="Progress & results"
          to="/admin/progress"
        />
        <SummaryCard
          label="Certificates issued"
          value={summary.certificatesIssued}
          detail="Current digital certificates"
          icon="Certificates"
          to="/admin/progress"
        />
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-training-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-panel-kicker">Training activity</p>
              <h2>Training overview</h2>
            </div>
            <Link to="/admin/training">Manage content →</Link>
          </div>

          <div className="admin-module-list">
            {modules.length === 0 ? (
              <p className="admin-empty-copy">
                No active training modules are currently available.
              </p>
            ) : (
              modules.map((module) => (
                <article className="admin-module-row" key={module.id}>
                  <div className="admin-module-icon" aria-hidden="true">
                    {module.slug.includes('forklift') ? '▰' : '◫'}
                  </div>
                  <div className="admin-module-copy">
                    <div className="admin-module-title-row">
                      <strong>{module.title}</strong>
                      <span>{module.averageProgress}%</span>
                    </div>
                    <div
                      className="admin-module-progress"
                      role="progressbar"
                      aria-label={`${module.title} average progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={module.averageProgress}
                    >
                      <span style={{ width: `${module.averageProgress}%` }} />
                    </div>
                    <small>
                      {module.assignedCount} assigned · {module.completedCount}{' '}
                      completed
                    </small>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="admin-panel admin-attention-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-panel-kicker">At a glance</p>
              <h2>Needs attention</h2>
            </div>
          </div>

          <Link className="admin-attention-metric" to="/admin/assignments">
            <span>Outstanding assignments</span>
            <strong>{outstandingAssignments}</strong>
          </Link>
          <Link className="admin-attention-metric" to="/admin/users">
            <span>Trainee accounts</span>
            <strong>{summary.activeTrainees}</strong>
          </Link>
          <Link className="admin-attention-metric" to="/admin/progress">
            <span>Certificates issued</span>
            <strong>{summary.certificatesIssued}</strong>
          </Link>

          <div className="admin-quick-actions">
            <p>Quick actions</p>
            <Link to="/admin/users">Manage trainees</Link>
            <Link to="/admin/assignments">Assign training</Link>
            <Link to="/admin/progress">Review progress & results</Link>
          </div>
        </aside>
      </div>

      <section className="admin-panel admin-trainee-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-panel-kicker">Workforce monitoring</p>
            <h2>Trainee progress</h2>
          </div>
          <Link to="/admin/users">View all trainees →</Link>
        </div>

        {trainees.length === 0 ? (
          <p className="admin-empty-copy">No trainee accounts are available.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Trainee</th>
                  <th scope="col">Job role</th>
                  <th scope="col">Training</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Latest assessment</th>
                  <th scope="col">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {trainees.map((trainee) => {
                  const status = traineeStatus(
                    trainee.assignedCount,
                    trainee.completedCount,
                    trainee.progressPercentage,
                  );

                  return (
                    <tr key={trainee.id}>
                      <td>
                        <div className="admin-trainee-identity">
                          <span aria-hidden="true">
                            {trainee.firstName[0]}
                            {trainee.lastName[0]}
                          </span>
                          <div>
                            <strong>
                              {trainee.firstName} {trainee.lastName}
                            </strong>
                            <small>{trainee.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{trainee.jobRole ?? 'Awaiting role'}</td>
                      <td>
                        {trainee.completedCount} / {trainee.assignedCount}{' '}
                        complete
                      </td>
                      <td>
                        <span
                          className={`admin-status admin-status-${status
                            .toLowerCase()
                            .replaceAll(' ', '-')}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td>
                        {trainee.latestAssessmentScore === null ? (
                          <span className="admin-muted">Not attempted</span>
                        ) : (
                          <span>
                            {trainee.latestAssessmentScore}% ·{' '}
                            {trainee.latestAssessmentPassed
                              ? 'Passed'
                              : 'Not passed'}
                          </span>
                        )}
                      </td>
                      <td>
                        {trainee.certificateIssued ? (
                          <span className="admin-certificate-yes">Issued</span>
                        ) : (
                          <span className="admin-muted">Not issued</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
