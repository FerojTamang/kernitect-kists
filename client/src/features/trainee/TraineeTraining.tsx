import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import manualHandlingImage from '../../assets/training/manual-handling/manual-handling-hero.png';
import forkliftImage from '../../assets/images/dashboard/forklift-pedestrian-safety.jpg';
import { ApiError, apiRequest } from '../../services/api/request';
import type {
  DashboardAssignment,
  TraineeDashboardData,
} from './dashboard.types';
import { DashboardIcon } from './DashboardIcon';
import './trainee-training.css';

function learningLabel(assignment: DashboardAssignment): string {
  if (assignment.learningTotalSections > 0) {
    return `${assignment.learningProgressPercentage}% learning progress`;
  }
  return assignment.status === 'not_started'
    ? 'Not started'
    : 'Training in progress';
}

function statusLabel(status: DashboardAssignment['status']): string {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function TrainingCard({
  assignment,
  order,
}: {
  assignment: DashboardAssignment;
  order: number;
}) {
  const isManualHandling = assignment.title.toLowerCase().includes('manual');
  return (
    <article className="assigned-module-card">
      <div className="assigned-module-visual">
        <img
          className="assigned-module-image"
          src={isManualHandling ? manualHandlingImage : forkliftImage}
          alt={
            isManualHandling
              ? 'Warehouse worker preparing a manual handling lift'
              : 'Forklift operating near a warehouse pedestrian route'
          }
        />
        <span className={`module-status-badge ${assignment.status}`}>
          {statusLabel(assignment.status)}
        </span>
      </div>
      <div className="assigned-module-content">
        <span className="module-order">Module {order}</span>
        <h2>
          {assignment.title === 'Forklift and Pedestrian Safety'
            ? 'Forklift & Pedestrian Safety'
            : assignment.title}
        </h2>
        <p>{assignment.description}</p>
        <div className="assigned-module-meta">
          <span className={`module-state ${assignment.status}`}>
            {learningLabel(assignment)}
          </span>
          {assignment.learningTotalSections > 0 ? (
            <span>
              {assignment.learningCompletedSections} of{' '}
              {assignment.learningTotalSections} sections complete
            </span>
          ) : null}
        </div>
        {assignment.learningTotalSections > 0 && (
          <div
            className="assigned-learning-track"
            role="progressbar"
            aria-label={`${assignment.title} learning progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={assignment.learningProgressPercentage}
          >
            <span
              style={{ width: `${assignment.learningProgressPercentage}%` }}
            />
          </div>
        )}
        {isManualHandling ? (
          <Link
            className="dashboard-action compact"
            to={`/trainee/training/${assignment.assignmentId}`}
          >
            {assignment.learningCompletedSections
              ? 'Continue Learning'
              : 'Start Learning'}{' '}
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="module-coming-soon">
            Training content coming in a later development phase
          </span>
        )}
      </div>
    </article>
  );
}

export function TraineeTraining() {
  const [dashboard, setDashboard] = useState<TraineeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTraining() {
    setLoading(true);
    setError(null);
    try {
      setDashboard(
        await apiRequest<TraineeDashboardData>('/trainee/dashboard'),
      );
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError('We could not load your assigned training. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTraining(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading)
    return (
      <TrainingListState
        title="Loading your training"
        detail="Preparing your assigned modules..."
        loading
      />
    );
  if (error || !dashboard) {
    return (
      <TrainingListState
        title="Training unavailable"
        detail={error ?? 'Please try again.'}
      >
        <button
          className="dashboard-action"
          type="button"
          onClick={() => void loadTraining()}
        >
          Try again <span aria-hidden="true">↻</span>
        </button>
      </TrainingListState>
    );
  }

  return (
    <div className="assigned-training-page">
      <header className="assigned-training-header">
        <div>
          <p className="eyebrow">My Training</p>
          <h1>Your assigned training</h1>
          <p className="lead">
            Work through the safety learning assigned to your trainee account.
          </p>
        </div>
        <Link className="secondary-link" to="/trainee/dashboard">
          ← Dashboard
        </Link>
      </header>
      <section
        className="assigned-training-summary"
        aria-label="Assigned training summary"
      >
        <div className="training-stat assigned">
          <span className="training-stat-icon">
            <DashboardIcon name="Resources" />
          </span>
          <span className="training-stat-copy">
            <span className="training-stat-label">Assigned Training</span>
            <strong>{dashboard.summary.totalAssigned}</strong>
            <span>modules</span>
          </span>
        </div>
        <div className="training-stat progress">
          <span className="training-stat-icon">
            <DashboardIcon name="clock" />
          </span>
          <span className="training-stat-copy">
            <span className="training-stat-label">In Progress</span>
            <strong>{dashboard.summary.inProgress}</strong>
            <span>training</span>
          </span>
        </div>
        <div className="training-stat pending">
          <span className="training-stat-icon">
            <DashboardIcon name="arrow" />
          </span>
          <span className="training-stat-copy">
            <span className="training-stat-label">Not Started</span>
            <strong>{dashboard.summary.notStarted}</strong>
            <span>training</span>
          </span>
        </div>
      </section>
      <section
        className="assigned-module-list"
        aria-label="Assigned training modules"
      >
        {dashboard.assignedTraining.map((assignment, index) => (
          <TrainingCard
            key={assignment.assignmentId}
            assignment={assignment}
            order={index + 1}
          />
        ))}
      </section>
    </div>
  );
}

function TrainingListState({
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
    <main className="training-empty-state" role={loading ? 'status' : 'alert'}>
      <div className="card">
        <p className="eyebrow">KISTS / My Training</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        {children}
      </div>
    </main>
  );
}
