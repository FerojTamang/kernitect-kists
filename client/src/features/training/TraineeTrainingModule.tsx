import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import manualHandlingImage from '../../assets/images/dashboard/manual-handling.jpg';
import { ApiError, apiRequest } from '../../services/api/request';
import './training-module.css';

interface FormativeOption {
  id: number;
  optionText: string;
  sequenceOrder: number;
}
interface FormativeQuestion {
  id: number;
  questionText: string;
  sequenceOrder: number;
  options: FormativeOption[];
  selectedOptionId: number | null;
  answeredCorrectly: boolean;
}
interface TrainingSection {
  id: number;
  title: string;
  contentType: 'text' | 'image' | 'video' | 'document' | 'link';
  body: string | null;
  resourceReference: string | null;
  sequenceOrder: number;
  isActive: boolean;
  completedAt: string | null;
  formativeQuestions: FormativeQuestion[];
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
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
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

  async function answerQuestion(question: FormativeQuestion, optionId: number) {
    if (!module || submitting !== null) return;
    const section = module.sections[activeIndex];
    if (!section) return;
    setSubmitting(question.id);
    setError(null);
    try {
      const result = await apiRequest<{
        correct: boolean;
        feedback: string;
        sectionComplete: boolean;
        module: TrainingModuleResponse;
      }>(
        `/trainee/training/${module.assignmentId}/content/${section.id}/questions/${question.id}/answer`,
        { method: 'POST', body: JSON.stringify({ optionId }) },
      );
      setModule(result.module);
      setFeedback((current) => ({
        ...current,
        [question.id]: result.feedback,
      }));
      if (result.sectionComplete) {
        const next = result.module.sections.findIndex(
          (section) => !section.completedAt,
        );
        setActiveIndex(next === -1 ? result.module.sections.length - 1 : next);
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError('Your answer could not be saved right now. Please try again.');
    } finally {
      setSubmitting(null);
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
  if (error || !module)
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

  const allComplete =
    module.progress.learningProgressPercentage === 100 &&
    module.sections.length > 0;
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
                Complete each learning section and check your understanding
                before moving to the next stage.
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
              <span>
                {module.progress.completedSections} of{' '}
                {module.progress.totalSections} sections completed
              </span>
              <strong>
                {module.progress.learningProgressPercentage}% learning progress
              </strong>
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
            feedback={feedback}
            submitting={submitting}
            onPrevious={() => setActiveIndex((index) => Math.max(0, index - 1))}
            onNext={() =>
              setActiveIndex((index) =>
                Math.min(module.sections.length - 1, index + 1),
              )
            }
            onAnswer={answerQuestion}
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
  feedback,
  submitting,
  onPrevious,
  onNext,
  onAnswer,
}: {
  section?: TrainingSection;
  index: number;
  total: number;
  feedback: Record<number, string>;
  submitting: number | null;
  onPrevious: () => void;
  onNext: () => void;
  onAnswer: (question: FormativeQuestion, optionId: number) => Promise<void>;
}) {
  if (!section) return null;
  const checksComplete =
    section.formativeQuestions.length > 0 &&
    section.formativeQuestions.every((question) => question.answeredCorrectly);
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
      <KnowledgeCheck
        section={section}
        feedback={feedback}
        submitting={submitting}
        onAnswer={onAnswer}
        checksComplete={checksComplete}
      />
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
          <span className="completion-hint">
            Answer both questions correctly to complete this section.
          </span>
        )}
      </div>
    </article>
  );
}

function KnowledgeCheck({
  section,
  feedback,
  submitting,
  onAnswer,
  checksComplete,
}: {
  section: TrainingSection;
  feedback: Record<number, string>;
  submitting: number | null;
  onAnswer: (question: FormativeQuestion, optionId: number) => Promise<void>;
  checksComplete: boolean;
}) {
  return (
    <section
      className="knowledge-check"
      aria-labelledby="understanding-heading"
    >
      <div className="knowledge-check-heading">
        <div>
          <p className="content-kicker">Practice check</p>
          <h3 id="understanding-heading">Check your understanding</h3>
        </div>
        <span>
          {
            section.formativeQuestions.filter(
              (question) => question.answeredCorrectly,
            ).length
          }{' '}
          of {section.formativeQuestions.length} correct
        </span>
      </div>
      {section.formativeQuestions.map((question, index) => (
        <div className="question-card" key={question.id}>
          <p className="question-number">
            Question {index + 1} of {section.formativeQuestions.length}
          </p>
          <h4>{question.questionText}</h4>
          <div className="answer-options">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${question.selectedOptionId === option.id ? (question.answeredCorrectly ? 'selected-correct' : 'selected-wrong') : ''}`}
                onClick={() => void onAnswer(question, option.id)}
                disabled={submitting !== null || question.answeredCorrectly}
              >
                {option.optionText}
              </button>
            ))}
          </div>
          {feedback[question.id] ? (
            <p
              className={`answer-feedback ${question.answeredCorrectly ? 'correct' : 'incorrect'}`}
              role="status"
            >
              {question.answeredCorrectly ? '✓ ' : 'Try again: '}
              {feedback[question.id]}
            </p>
          ) : null}
        </div>
      ))}
      {checksComplete ? (
        <p className="check-complete" role="status">
          ✓ Both answers are correct. Section completed.
        </p>
      ) : null}
    </section>
  );
}

function SectionBody({ section }: { section: TrainingSection }) {
  if (section.title === 'Introduction')
    return (
      <>
        <h3>What is manual handling?</h3>
        <p>{section.body}</p>
        <div className="info-panel">
          Manual handling includes pushing, pulling, carrying and holding, not
          only lifting.
        </div>
      </>
    );
  if (section.title === 'Risks and Injuries')
    return (
      <>
        <h3>Common injuries from manual handling</h3>
        <p>Poor manual handling can cause:</p>
        <ul>
          <li>Back pain</li>
          <li>Muscle strain</li>
          <li>Joint injury</li>
          <li>Musculoskeletal injury</li>
        </ul>
        <div className="warning-panel">
          <strong>Take care with every lift.</strong>
          <span>{section.body}</span>
        </div>
      </>
    );
  if (section.title === 'Assessing the Task and Load')
    return (
      <>
        <h3>Assess before you move</h3>
        <p>{section.body}</p>
        <ul>
          <li>Check the load and route.</li>
          <li>Identify obstacles and the destination.</li>
          <li>Consider your capability, assistance and equipment.</li>
        </ul>
      </>
    );
  if (section.title === 'Safe Lifting Techniques')
    return (
      <>
        <h3>The key steps to safe lifting</h3>
        <p>Follow these steps:</p>
        <ol className="technique-list">
          {[
            'Plan the lift.',
            'Assess the load and route.',
            'Set stable footing.',
            'Bend your knees.',
            'Secure a firm grip.',
            'Keep the load close.',
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
        Compare the examples and choose the technique that protects your body.
      </p>
      <div className="example-grid">
        <div className="example-card unsafe">
          <span>× Unsafe</span>
          <strong>Bending from the waist</strong>
          <small>
            Twisting or carrying a load that blocks your view can cause harm.
          </small>
        </div>
        <div className="example-card safe">
          <span>✓ Safe</span>
          <strong>Bending your knees</strong>
          <small>
            Keep your back steady, hold the load close and ask for help.
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
      <p>
        You have completed all Manual Handling learning sections and knowledge
        checks.
      </p>
      <p className="completion-progress">
        5 of 5 sections completed · 100% learning progress
      </p>
      <div className="next-stage">
        <strong>Next stage</strong>
        <span>Interactive Warehouse Safety Scenario</span>
        <small>Coming next</small>
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
