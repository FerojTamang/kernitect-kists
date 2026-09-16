import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import warehouseSceneImage from '../../assets/training/manual-handling/manual-handling-hero.png';
import forkliftImage from '../../assets/images/dashboard/forklift-pedestrian-safety.jpg';
import { ApiError, apiRequest } from '../../services/api/request';
import type {
  DashboardAssignment,
  TraineeDashboardData,
} from './dashboard.types';
import './trainee-scenarios.css';

function isManualHandling(assignment: DashboardAssignment): boolean {
  return assignment.title.toLowerCase().includes('manual');
}

function ScenarioCard({ assignment }: { assignment: DashboardAssignment }) {
  const manualHandling = isManualHandling(assignment);
  const learningComplete =
    assignment.learningTotalSections > 0 &&
    assignment.learningCompletedSections >= assignment.learningTotalSections;

  if (!manualHandling) {
    return (
      <article className="scenario-library-card card">
        <img
          className="scenario-library-image"
          src={forkliftImage}
          alt="Forklift operating near a warehouse pedestrian route"
        />
        <div className="scenario-library-body">
          <div className="scenario-library-heading-row">
            <span className="scenario-library-kicker">Future scenario</span>
            <span className="scenario-library-status planned">Planned</span>
          </div>
          <h2>{assignment.title}</h2>
          <p>
            This assigned module is part of the KISTS training scope, but its
            interactive scenario is not included in the current prototype.
          </p>
          <span className="scenario-library-note">Scenario coming later</span>
        </div>
      </article>
    );
  }

  return (
    <article className="scenario-library-card card">
      <img
        className="scenario-library-image"
        src={warehouseSceneImage}
        alt="Warehouse manual handling training scene"
      />
      <div className="scenario-library-body">
        <div className="scenario-library-heading-row">
          <span className="scenario-library-kicker">Manual Handling</span>
          <span
            className={`scenario-library-status ${learningComplete ? 'ready' : 'locked'}`}
          >
            {learningComplete ? 'Ready' : 'Locked'}
          </span>
        </div>
        <h2>Interactive Warehouse Safety Scenario</h2>
        <p>
          Apply what you learned by reviewing five warehouse safety situations
          and choosing the safer manual-handling response.
        </p>

        <div className="scenario-library-meta">
          <span>5 safety decision points</span>
          <span>
            {assignment.learningCompletedSections} of{' '}
            {assignment.learningTotalSections} learning sections complete
          </span>
        </div>

        <div
          className="scenario-library-progress"
          role="progressbar"
          aria-label="Manual Handling learning prerequisite progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={assignment.learningProgressPercentage}
        >
          <span
            style={{ width: `${assignment.learningProgressPercentage}%` }}
          />
        </div>

        {learningComplete ? (
          <Link
            className="scenario-library-action primary"
            to={`/trainee/training/${assignment.assignmentId}/scenario`}
          >
            Open Scenario <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <div className="scenario-library-locked-copy">
            <p>
              Complete all Manual Handling learning sections and knowledge
              checks to unlock this scenario.
            </p>
            <Link
              className="scenario-library-action secondary"
              to={`/trainee/training/${assignment.assignmentId}`}
            >
              Continue Learning <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

export function TraineeScenarios() {
  const [dashboard, setDashboard] = useState<TraineeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadScenarios() {
    setLoading(true);
    setError(null);
    try {
      setDashboard(
        await apiRequest<TraineeDashboardData>('/trainee/dashboard'),
      );
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError('We could not load your assigned scenarios. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadScenarios(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const assignments = useMemo(
    () => dashboard?.assignedTraining ?? [],
    [dashboard],
  );

  if (loading) {
    return (
      <ScenarioLibraryState
        title="Loading your scenarios"
        detail="Preparing your interactive safety activities..."
        loading
      />
    );
  }

  if (error || !dashboard) {
    return (
      <ScenarioLibraryState
        title="Scenarios unavailable"
        detail={error ?? 'Please try again.'}
      >
        <button
          className="scenario-library-action primary"
          type="button"
          onClick={() => void loadScenarios()}
        >
          Try again <span aria-hidden="true">↻</span>
        </button>
      </ScenarioLibraryState>
    );
  }

  return (
    <div className="scenario-library-page">
      <header className="scenario-library-header">
        <div>
          <p className="eyebrow">Scenarios</p>
          <h1>Interactive safety scenarios</h1>
          <p className="lead">
            Apply your learning in workplace situations and practise safer
            decisions before the final assessment.
          </p>
        </div>
        <Link className="secondary-link" to="/trainee/training">
          ← My Training
        </Link>
      </header>

      <section className="scenario-library-intro card">
        <div>
          <span className="scenario-library-intro-icon" aria-hidden="true">
            ◧
          </span>
        </div>
        <div>
          <strong>Learning comes first</strong>
          <p>
            A module scenario unlocks only after its required learning content
            and formative checks are complete.
          </p>
        </div>
      </section>

      <section
        className="scenario-library-list"
        aria-label="Assigned scenarios"
      >
        {assignments.length ? (
          assignments.map((assignment) => (
            <ScenarioCard
              key={assignment.assignmentId}
              assignment={assignment}
            />
          ))
        ) : (
          <div className="scenario-library-empty card">
            <h2>No scenarios assigned</h2>
            <p>
              Your assigned interactive training scenarios will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ScenarioLibraryState({
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
      className="scenario-library-state card"
      role={loading ? 'status' : 'alert'}
    >
      <p className="eyebrow">KISTS / Scenarios</p>
      <h1>{title}</h1>
      <p>{detail}</p>
      {children}
    </section>
  );
}
