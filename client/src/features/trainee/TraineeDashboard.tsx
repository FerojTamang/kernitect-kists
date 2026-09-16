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
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
}) {
  return (
    <article className="summary-card">
      <span className="summary-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="summary-copy">
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

type DisplayAssignment = DashboardAssignment & {
  future?: boolean;
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
        <span className="training-status status-in_progress">In progress</span>
      </div>

      <div className="continue-learning-body">
        <div className="continue-learning-kicker">Manual Handling</div>
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
              ◔
            </span>
            {assignment.dueAt
              ? `Approx. ${Math.max(15, 60 - learningProgress)} mins remaining`
              : 'On track'}
          </span>
          <button
            className="dashboard-action compact"
            type="button"
            onClick={() =>
              navigate(`/trainee/training/${assignment.assignmentId}`)
            }
          >
            {actionLabel} <span aria-hidden="true">→</span>
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
        <span
          className={`training-status ${assignment.future ? 'status-future' : `status-${assignment.status}`}`}
        >
          {assignment.future
            ? 'Future training'
            : statusLabel(assignment.status)}
        </span>
      </div>
      <div className="mini-training-body">
        <h3>{assignment.title}</h3>
        <p>{assignment.description}</p>

        <div className="mini-training-meta">
          <div className="mini-metadata">
            <span>
              <span aria-hidden="true">◔</span>
              {assignment.future
                ? 'Coming soon'
                : `${Math.max(10, 45 - assignment.progressPercentage)} mins`}
            </span>
            <span>
              <span aria-hidden="true">▣</span>
              {assignment.future
                ? 'Not started'
                : `${assignment.title.toLowerCase().includes('manual') ? assignment.learningProgressPercentage : assignment.progressPercentage}%`}
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
            <span aria-hidden="true">→</span>
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

  if (displayCards.length < 3) {
    const futureCards = [
      {
        title: 'Fire Safety Basics',
        description:
          'Understand fire risks, prevention and emergency procedures.',
      },
      {
        title: 'Working at Height',
        description:
          'Learn to identify risks and work safely when working at height.',
      },
    ];

    for (const futureCard of futureCards) {
      if (displayCards.length >= 3) break;
      displayCards.push({
        assignmentId: -displayCards.length - 1,
        moduleId: 0,
        title: futureCard.title,
        description: futureCard.description,
        required: false,
        status: 'not_started',
        progressPercentage: 0,
        learningProgressPercentage: 0,
        learningCompletedSections: 0,
        learningTotalSections: 0,
        assignedAt: new Date().toISOString(),
        dueAt: null,
        nextAction: 'start',
        future: true,
        image: getModuleImage(futureCard.title),
      });
    }
  }

  return (
    <div className="trainee-dashboard">
      <div className="dashboard-top-row">
        <div className="dashboard-profile">
          <button
            className="notification-bell"
            type="button"
            aria-label="Notifications"
          >
            <span aria-hidden="true">🔔</span>
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
            ▾
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
          icon="▣"
        />
        <SummaryCard
          label="Completed Training"
          value={summary.completed}
          detail="Modules"
          icon="✓"
        />
        <SummaryCard
          label="Overall Progress"
          value={`${summary.overallProgressPercentage}%`}
          detail="Across assigned training"
          icon="▥"
        />
        <SummaryCard
          label="Job Role"
          value={trainee.jobRole ?? 'Trainee'}
          detail="Current workplace role"
          icon="◉"
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
            <div className="training-grid">
              {displayCards.map((assignment) => (
                <AssignedTrainingCard
                  key={assignment.assignmentId}
                  assignment={assignment}
                />
              ))}
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
                ⏱
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
                <div className="empty-activity-row">
                  <span className="activity-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span>Training progress is being tracked.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="support-card">
            <div className="support-mark" aria-hidden="true">
              ?
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
