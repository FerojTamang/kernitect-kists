import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dashboardHero from '../../assets/images/dashboard/dashboard-hero.jpg';
import manualHandlingImage from '../../assets/images/dashboard/manual-handling.jpg';
import forkliftImage from '../../assets/images/dashboard/forklift-pedestrian-safety.jpg';
import fireSafetyImage from '../../assets/images/dashboard/fire-safety-basics.jpg';
import workingAtHeightImage from '../../assets/images/dashboard/working-at-height.jpg';
import { apiRequest, ApiError } from '../../services/api/request';
import type {
  AssignmentStatus,
  DashboardAssignment,
  TraineeDashboardData,
} from './dashboard.types';
import './trainee-dashboard.css';
import { DashboardIcon } from './DashboardIcon';

function statusLabel(status: AssignmentStatus): string {
  return status === 'in_progress'
    ? 'In progress'
    : status === 'completed'
      ? 'Completed'
      : 'Not started';
}

function getModuleImage(title: string): string {
  const normalized = title.toLowerCase();

  if (normalized.includes('manual')) return manualHandlingImage;
  if (normalized.includes('forklift') || normalized.includes('pedestrian'))
    return forkliftImage;
  if (normalized.includes('fire')) return fireSafetyImage;
  if (normalized.includes('height')) return workingAtHeightImage;

  return manualHandlingImage;
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  progress,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  progress?: number;
}) {
  return (
    <article className="summary-card">
      <span className="summary-icon" aria-hidden="true">
        <DashboardIcon name={icon} />
      </span>
      <div className="summary-copy">
        <p>{label}</p>
        <strong>{value}</strong>
        {progress !== undefined && (
          <div className="summary-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
        <span>{detail}</span>
      </div>
    </article>
  );
}

type DisplayAssignment = DashboardAssignment & {
  image: string;
};

function ContinueLearningCard({
  assignment,
}: {
  assignment: DashboardAssignment;
}) {
  const navigate = useNavigate();
  const learningProgress = assignment.title.toLowerCase().includes('manual')
    ? assignment.learningProgressPercentage
    : assignment.progressPercentage;
  const actionLabel =
    assignment.nextAction === 'start'
      ? 'Start'
      : assignment.nextAction === 'continue'
        ? 'Continue'
        : 'Review';

  return (
    <article className="continue-learning-card">
      <div className="continue-learning-image-wrap" aria-hidden="true">
        <img src={getModuleImage(assignment.title)} alt="" />
        <span className={`training-status status-${assignment.status}`}>
          {statusLabel(assignment.status)}
        </span>
      </div>

      <div className="continue-learning-body">
        <div className="continue-learning-kicker">{assignment.title}</div>
        <h3>{assignment.title}</h3>
        <p>{assignment.description}</p>

        <div className="continue-learning-progress">
          <div
            className="progress-track"
            role="progressbar"
            aria-label={`${assignment.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={learningProgress}
          >
            <span style={{ width: `${learningProgress}%` }} />
          </div>
          <span className="progress-value">
            Learning progress {learningProgress}%
          </span>
        </div>
        {assignment.learningTotalSections > 0 ? (
          <p className="learning-progress-detail">
            {assignment.learningCompletedSections} of{' '}
            {assignment.learningTotalSections} sections complete
          </p>
        ) : null}

        <div className="continue-learning-meta">
          <span>
            <span className="meta-clock" aria-hidden="true">
              <DashboardIcon name="clock" />
            </span>
            {assignment.dueAt
              ? `Due ${new Date(assignment.dueAt).toLocaleDateString()}`
              : statusLabel(assignment.status)}
          </span>
          <button
            className="dashboard-action compact"
            type="button"
            onClick={() =>
              navigate(`/trainee/training/${assignment.assignmentId}`)
            }
          >
            {actionLabel} <DashboardIcon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  );
}

function AssignedTrainingCard({
  assignment,
}: {
  assignment: DisplayAssignment;
}) {
  const navigate = useNavigate();
  const actionLabel =
    assignment.nextAction === 'start'
      ? 'Start'
      : assignment.nextAction === 'continue'
        ? 'Continue'
        : 'Review';

  return (
    <article className="mini-training-card">
      <div className="mini-training-art" aria-hidden="true">
        <img src={assignment.image} alt="" />
        <span className={`training-status status-${assignment.status}`}>
          {statusLabel(assignment.status)}
        </span>
      </div>
      <div className="mini-training-body">
        <h3>{assignment.title}</h3>
        <p>{assignment.description}</p>

        <div className="mini-training-meta">
          <div className="mini-metadata">
            <span>
              <DashboardIcon name="clock" />
              {assignment.required ? 'Required' : 'Optional'}
            </span>
            <span>
              <DashboardIcon name="Progress" />
              {`${assignment.title.toLowerCase().includes('manual') ? assignment.learningProgressPercentage : assignment.progressPercentage}%`}
            </span>
          </div>
          <button
            className="dashboard-action compact small"
            type="button"
            onClick={() =>
              navigate(`/trainee/training/${assignment.assignmentId}`)
            }
          >
            {actionLabel}
            <DashboardIcon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function TraineeDashboard() {
  const [dashboard, setDashboard] = useState<TraineeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      setDashboard(
        await apiRequest<TraineeDashboardData>('/trainee/dashboard'),
      );
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError("We couldn't load your training dashboard. Please try again.");
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
        title="Loading your dashboard"
        detail="Preparing your latest training information…"
        loading
      />
    );
  }
  if (error) {
    return (
      <DashboardState title="Your dashboard is unavailable" detail={error}>
        <button
          className="dashboard-action"
          type="button"
          onClick={() => void loadDashboard()}
        >
          Try again <span aria-hidden="true">↻</span>
        </button>
      </DashboardState>
    );
  }
  if (!dashboard) return null;

  const { trainee, summary, assignedTraining } = dashboard;
  const inProgress =
    assignedTraining.find(
      (assignment) => assignment.status === 'in_progress',
    ) ?? assignedTraining[0];

  const displayCards: DisplayAssignment[] = assignedTraining
    .slice(0, 3)
    .map((assignment) => ({
      ...assignment,
      image: getModuleImage(assignment.title),
    }));

  return (
    <div className="trainee-dashboard">
      <div className="dashboard-top-row">
        <div className="dashboard-profile">
          <button
            className="notification-bell"
            type="button"
            aria-label="Notifications"
          >
            <DashboardIcon name="bell" />
          </button>
          <div className="profile-divider" aria-hidden="true" />
          <span className="profile-avatar" aria-hidden="true">
            {trainee.firstName[0]}
            {trainee.lastName[0]}
          </span>
          <div className="profile-meta">
            <strong>
              {trainee.firstName} {trainee.lastName}
            </strong>
            <small>Trainee</small>
          </div>
          <span className="chevron" aria-hidden="true">
            <DashboardIcon name="chevron" />
          </span>
        </div>
      </div>

      <header className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">Trainee Dashboard</p>
          <h1>Welcome back, {trainee.firstName}</h1>
          <p className="hero-subtitle">
            Keep learning. Stay safe. A safer tomorrow, together.
          </p>
        </div>

        <div className="dashboard-hero-visual" aria-hidden="true">
          <img src={dashboardHero} alt="" />
        </div>

        <div className="dashboard-quote">
          <span>“Safety is a skill</span>
          <span>for life.”</span>
          <i aria-hidden="true" />
        </div>
      </header>

      <section className="summary-grid" aria-label="Training summary">
        <SummaryCard
          label="Assigned Training"
          value={summary.totalAssigned}
          detail={`${summary.inProgress} in progress`}
          icon="Resources"
        />
        <SummaryCard
          label="Completed Training"
          value={summary.completed}
          detail="Modules"
          icon="check"
        />
        <SummaryCard
          label="Overall Progress"
          value={`${summary.overallProgressPercentage}%`}
          detail="Across assigned training"
          icon="Progress"
          progress={summary.overallProgressPercentage}
        />
        <SummaryCard
          label="Job Role"
          value={trainee.jobRole ?? 'Trainee'}
          detail="Current workplace role"
          icon="person"
        />
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="dashboard-panel continue-panel">
            <div className="panel-heading">
              <h2>Continue Learning</h2>
              <Link to="/trainee/training">View all training →</Link>
            </div>
            {inProgress ? (
              <ContinueLearningCard assignment={inProgress} />
            ) : (
              <EmptyTrainingState />
            )}
          </section>

          <section className="dashboard-panel assigned-panel">
            <div className="panel-heading">
              <h2>Your Assigned Training</h2>
              <Link to="/trainee/training">View all →</Link>
            </div>
            <div
              className="training-grid"
              style={
                {
                  '--training-columns': Math.max(1, displayCards.length),
                } as React.CSSProperties
              }
            >
              {displayCards.map((assignment) => (
                <AssignedTrainingCard
                  key={assignment.assignmentId}
                  assignment={assignment}
                />
              ))}
              {displayCards.length === 0 && <EmptyTrainingState />}
            </div>
          </section>
        </div>

        <aside className="dashboard-support-column">
          <section className="dashboard-panel upcoming-panel">
            <div className="panel-heading">
              <h2>Upcoming Assessment</h2>
              <Link to="/trainee/assessments">View all →</Link>
            </div>
            <div className="empty-support-state">
              <div className="support-badge" aria-hidden="true">
                <DashboardIcon name="calendar" />
              </div>
              <div className="support-copy">
                <strong>No upcoming assessments.</strong>
                <p>When a new assessment is scheduled, it will appear here.</p>
              </div>
            </div>
          </section>

          <section className="dashboard-panel activity-panel">
            <div className="panel-heading">
              <h2>Recent Activity</h2>
              <Link to="/trainee/progress">View all →</Link>
            </div>
            <div className="empty-support-state compact">
              <div className="activity-list">
                {assignedTraining.length > 0 ? (
                  assignedTraining.slice(0, 4).map((assignment) => (
                    <div
                      className={`empty-activity-row ${assignment.status}`}
                      key={assignment.assignmentId}
                    >
                      <span className="activity-icon">
                        <DashboardIcon
                          name={
                            assignment.status === 'completed'
                              ? 'check'
                              : 'Resources'
                          }
                        />
                      </span>
                      <span>
                        {statusLabel(assignment.status)}: {assignment.title}
                      </span>
                      <small>{assignment.progressPercentage}%</small>
                    </div>
                  ))
                ) : (
                  <p>No training activity yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="support-card">
            <div className="support-mark" aria-hidden="true">
              <DashboardIcon name="help" />
            </div>
            <div className="support-copy">
              <h2>Need help?</h2>
              <p>Contact your administrator or visit our help resources.</p>
            </div>
            <button className="support-button" type="button">
              Contact Administrator
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function EmptyTrainingState() {
  return (
    <div className="empty-training">
      <strong>No training has been assigned yet.</strong>
      <p>Your administrator will add training here when it is ready.</p>
    </div>
  );
}

function DashboardState({
  title,
  detail,
  loading = false,
  children,
}: {
  title: string;
  detail: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`dashboard-state ${loading ? 'is-loading' : ''}`}
      role={loading ? 'status' : 'alert'}
    >
      <span className="state-mark" aria-hidden="true">
        {loading ? '…' : '!'}
      </span>
      <h1>{title}</h1>
      <p>{detail}</p>
      {children}
    </section>
  );
}
