import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import manualHandlingImage from '../../assets/images/dashboard/manual-handling.jpg';
import { ApiError, apiRequest } from '../../services/api/request';
import './training-module.css';

interface TrainingSection {
  id: number;
  title: string;
  contentType: 'text' | 'image' | 'video' | 'document' | 'link';
  body: string | null;
  resourceReference: string | null;
  sequenceOrder: number;
  isActive: boolean;
  completedAt: string | null;
}

interface TrainingModuleResponse {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  status: 'completed' | 'in_progress' | 'not_started';
  progress: {
    assignmentPercentage: number;
    learningProgressPercentage: number;
    completedSections: number;
    totalSections: number;
    startedAt: string | null;
    completedAt: string | null;
    lastAccessedAt: string | null;
  };
  sections: TrainingSection[];
  resumeSectionIndex: number;
}

export function TraineeTrainingModule() {
  const { assignmentId } = useParams();
  const [module, setModule] = useState<TrainingModuleResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<TrainingModuleResponse>(
        `/trainee/training/${assignmentId}`,
      );
      setModule(payload);
      setActiveIndex(payload.resumeSectionIndex);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError('We could not load this training module. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadModule(), 0);
    return () => window.clearTimeout(timer);
  }, [loadModule]);

  async function completeCurrentSection() {
    const section = module?.sections[activeIndex];
    if (!module || !section || section.completedAt || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<TrainingModuleResponse>(
        `/trainee/training/${module.assignmentId}/content/${section.id}/complete`,
        { method: 'POST' },
      );
      setModule(updated);
      const nextIncomplete = updated.sections.findIndex(
        (item) => !item.completedAt,
      );
      setActiveIndex(
        nextIncomplete === -1 ? updated.sections.length - 1 : nextIncomplete,
      );
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError('Your section completion could not be saved right now.');
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <TrainingState
        title="Loading training"
        detail="Preparing your learning content..."
        loading
      />
    );
  if (error || !module) {
    return (
      <TrainingState
        title="Training module unavailable"
        detail={error ?? 'Please try again.'}
      >
        <button
          className="dashboard-action"
          type="button"
          onClick={() => void loadModule()}
        >
          Try again <span aria-hidden="true">↻</span>
        </button>
      </TrainingState>
    );
  }

  const allComplete =
    module.sections.length > 0 &&
    module.progress.learningProgressPercentage === 100;
  return (
    <div className="training-module-page">
      <header className="training-module-header">
        <div>
          <p className="eyebrow">My Training / Manual Handling</p>
          <h1>
            {allComplete ? 'Learning content complete' : module.moduleTitle}
          </h1>
        </div>
        <Link className="secondary-link" to="/trainee/dashboard">
          ← Back to dashboard
        </Link>
      </header>
      {allComplete ? (
        <CompletionState />
      ) : (
        <>
          <section className="module-overview card">
            <div className="overview-copy">
              <span className="status-badge">
                {module.status === 'in_progress'
                  ? 'In progress'
                  : 'Not started'}
              </span>
              <h2>Manual Handling</h2>
              <p>
                Complete all four learning sections to prepare for the
                interactive warehouse safety scenario.
              </p>
              <p className="module-facts">
                <strong>{module.progress.totalSections} sections</strong>
                <span>Learning content</span>
                <span>Scenario follows</span>
              </p>
              <a className="dashboard-action compact" href="#section-content">
                {module.progress.completedSections
                  ? 'Continue learning'
                  : 'Start learning'}{' '}
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <img
              className="module-hero-image"
              src={manualHandlingImage}
              alt="Warehouse worker lifting a box safely"
            />
          </section>
          <section
            className="learning-progress card"
            aria-label="Learning progress"
          >
            <div className="progress-header">
              <span>Your learning progress</span>
              <strong>{module.progress.learningProgressPercentage}%</strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Learning content progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={module.progress.learningProgressPercentage}
            >
              <span
                style={{
                  width: `${module.progress.learningProgressPercentage}%`,
                }}
              />
            </div>
          </section>
          <section
            className="module-section-list card"
            aria-labelledby="section-list-heading"
          >
            <div className="section-list-heading">
              <div>
                <p className="content-kicker">Learning path</p>
                <h2 id="section-list-heading">Complete each section</h2>
              </div>
              <span>
                {module.progress.completedSections} of{' '}
                {module.progress.totalSections} complete
              </span>
            </div>
            <ol>
              {module.sections.map((section, index) => (
                <li
                  key={section.id}
                  className={`${index === activeIndex ? 'active' : ''} ${section.completedAt ? 'complete' : ''}`}
                >
                  <button type="button" onClick={() => setActiveIndex(index)}>
                    <span className="section-number">
                      {section.completedAt ? '✓' : `0${index + 1}`}
                    </span>
                    <span className="section-summary">
                      <strong>{section.title}</strong>
                      <small>
                        {section.completedAt
                          ? 'Completed'
                          : index === activeIndex
                            ? 'In progress'
                            : 'Not started'}
                      </small>
                    </span>
                    <span className="section-state">
                      {section.completedAt
                        ? 'Completed'
                        : index === activeIndex
                          ? 'In progress'
                          : 'Not started'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <SectionContent
            section={module.sections[activeIndex]}
            index={activeIndex}
            total={module.sections.length}
            saving={saving}
            onPrevious={() => setActiveIndex((index) => Math.max(0, index - 1))}
            onNext={() =>
              setActiveIndex((index) =>
                Math.min(module.sections.length - 1, index + 1),
              )
            }
            onComplete={() => void completeCurrentSection()}
          />
        </>
      )}
    </div>
  );
}

function SectionContent({
  section,
  index,
  total,
  saving,
  onPrevious,
  onNext,
  onComplete,
}: {
  section?: TrainingSection;
  index: number;
  total: number;
  saving: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
}) {
  if (!section) return null;
  return (
    <article className="section-content card" id="section-content">
      <div className="section-content-heading">
        <div>
          <p className="content-kicker">
            {String(index + 1).padStart(2, '0')} of {total}
          </p>
          <h2>{section.title}</h2>
        </div>
        <span
          className={`section-state-pill ${section.completedAt ? 'completed' : ''}`}
        >
          {section.completedAt ? '✓ Completed' : 'In progress'}
        </span>
      </div>
      <div className="section-content-grid">
        <div className="section-copy">
          <SectionBody section={section} />
        </div>
        <img
          className="section-image"
          src={manualHandlingImage}
          alt="Safe manual handling in a warehouse"
        />
      </div>
      <div className="section-actions">
        <button
          className="dashboard-action ghost"
          type="button"
          onClick={onPrevious}
          disabled={index === 0}
        >
          ← Previous
        </button>
        {section.completedAt ? (
          <button
            className="dashboard-action"
            type="button"
            onClick={onNext}
            disabled={index === total - 1}
          >
            Next <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            className="dashboard-action"
            type="button"
            onClick={onComplete}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Mark as Complete ✓'}
          </button>
        )}
      </div>
    </article>
  );
}

function SectionBody({ section }: { section: TrainingSection }) {
  if (section.title === 'Introduction')
    return (
      <>
        <h3>What is manual handling?</h3>
        <p>{section.body}</p>
        <div className="info-panel">
          Manual handling is not just about lifting. It also includes pushing,
          pulling, carrying and holding.
        </div>
      </>
    );
  if (section.title === 'Risks and Injuries')
    return (
      <>
        <h3>Common injuries from manual handling</h3>
        <p>Poor manual handling can cause a range of injuries, including:</p>
        <ul>
          <li>Back pain and slipped discs</li>
          <li>Muscle strains</li>
          <li>Joint injuries</li>
          <li>Musculoskeletal injuries</li>
        </ul>
        <div className="warning-panel">
          <strong>Take care with every lift.</strong>
          <span>{section.body}</span>
        </div>
      </>
    );
  if (section.title === 'Safe Lifting Techniques')
    return (
      <>
        <h3>The key steps to safe lifting</h3>
        <p>Follow these steps to lift safely:</p>
        <ol className="technique-list">
          {[
            'Plan the lift and assess your route.',
            'Assess the load, its weight and stability.',
            'Set stable footing before you move.',
            'Bend your knees, not your back.',
            'Secure a firm grip.',
            'Keep the load close to your body.',
            'Lift smoothly and avoid twisting.',
            'Ask for assistance or use equipment when needed.',
          ].map((step, stepIndex) => (
            <li key={step}>
              <span>{String(stepIndex + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      </>
    );
  return (
    <>
      <h3>Safe and unsafe lifting</h3>
      <p>
        Compare the examples below and choose the technique that protects your
        body.
      </p>
      <div className="example-grid">
        <div className="example-card unsafe">
          <span>× Unsafe</span>
          <strong>Bending from the waist</strong>
          <small>
            Twisting or reaching while carrying a load can put strain on your
            back.
          </small>
        </div>
        <div className="example-card safe">
          <span>✓ Safe</span>
          <strong>Bending your knees</strong>
          <small>
            Keep your back steady, hold the load close and ask for help when
            needed.
          </small>
        </div>
      </div>
    </>
  );
}

function CompletionState() {
  return (
    <section className="completion-state card">
      <span className="completion-check" aria-hidden="true">
        ✓
      </span>
      <p className="content-kicker">Manual Handling</p>
      <h2>Learning content complete</h2>
      <p>You have completed the Manual Handling learning sections.</p>
      <div className="next-stage">
        <strong>Next stage</strong>
        <span>Interactive warehouse safety scenario</span>
        <small>Coming next. The scenario is not available yet.</small>
      </div>
      <Link className="dashboard-action" to="/trainee/dashboard">
        Return to Dashboard
      </Link>
    </section>
  );
}

function TrainingState({
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
        <p className="eyebrow">KISTS / Learning content</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        {children}
      </div>
    </main>
  );
}
